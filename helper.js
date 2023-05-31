
const { MongoClient } = require('mongodb');
const async = require('async');
const ExcelJS = require('exceljs');
const fs = require('fs')

const { sendResponse } = require('./services/sendResponse');
const { sendTelegramMessage } = require('./services/telegramBot');
const url = 'mongodb://localhost:27017/';
const client = new MongoClient(url);
const Transactions = client.db('transactions')
const Archives = client.db('archives')

/**
 * This function attempts to connect to a MongoDB database and retries every 5 seconds if it fails.
 * @returns {Promise} The function `connectWithRetry` is returning a Promise object.
 */
const connectWithRetry = function () {
    return new Promise((resolve, reject) => {
        client.connect(async function (err) {
            if (err) {
                console.error('Failed to connect to mongo on startup - retrying in 5 sec', err);
                setTimeout(connectWithRetry, 5000);
            } else {
                console.log("MongoDB connected !!");
                resolve(null);
            }
        })
    })
}

/**
 * The function processes report data by saving transactions in MongoDB, creating Excel data, saving
 * Excel locally, and executing a callback function.
 * @param {JSON} data - The data parameter is the input data that needs to be processed. It could be an
 * object, an array, or any other data type that the functions in the waterfallFunctions array can
 * handle.
 * @param response - It is optional and can be replaced with the cb parameter
 * if it is not provided.
 * @param cb - cb stands for "callback" and is a function that will be called once all the asynchronous
 * functions in the waterfall have completed. It is an optional parameter, and if it is not provided,
 * the response parameter will be used as the callback function.
 */
const processReportData = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.fileName || !data.reportPath || !data.collectionName || !data.tgMessage || !data.data) {
        return cb(sendResponse(400, "Provide all the required field for report generation!", "processReportData", null, null))
    }
    let waterFallFunctions = []
    waterFallFunctions.push(async.apply(saveTransactionsInMongoDB, data))
    waterFallFunctions.push(async.apply(createExcelData, data))
    waterFallFunctions.push(async.apply(saveExcelLocally, data))
    waterFallFunctions.push(async.apply(sendTelegramMessage, data))
    async.waterfall(waterFallFunctions, cb)

}
exports.processReportData = processReportData

/**
 * The function saves transactions data in MongoDB and returns a response.
 * @param {JSON} data
 * @param response - The response parameter is a callback function that will be called with the result
 * of the saveTransactionsInMongoDB function. It is optional and can be replaced with the cb parameter
 * if it is not provided.
 * @param cb
 */
const saveTransactionsInMongoDB = (data, response, cb) => {
    if (!cb) {
        cb = response;
    }
    let collectionName = data.collectionName
    console.log(collectionName)
    const collection = Transactions.collection(collectionName);
    let insertArray = data.data
    if (!insertArray.length) {
        return cb(null, sendResponse(200, "Success", "saveTransactionsInMongoDB", null, null))
    }
    collection.insertMany(insertArray, (err, res) => {
        if (err) {
            console.log(err)
            return cb(sendResponse(500, "Something went wrong", "saveTransactionsInMongoDB", err, null))
        }
        return cb(null, sendResponse(200, "Success", "saveTransactionsInMongoDB", res, null))
    })
}

/**
 * The function saves transactions data in MongoDB and returns a response.
 * @param {JSON} data
 * @param response - The response parameter is a callback function that will be called with the result
 * of the saveTransactionsInMongoDB function. It is optional and can be replaced with the cb parameter
 * if it is not provided.
 * @param cb
 */
const archiveMarketTransactions = (data, response, cb) => {
    if (!cb) {
        cb = response;
    }
    let collectionName = data.collectionName
    console.log(collectionName)
    const collection = Archives.collection(collectionName);
    let insertArray = data.data
    if (!insertArray.length) {
        return cb(null, sendResponse(200, "Success", "archiveMarketTransactions", null, null))
    }
    collection.insertMany(insertArray, (err, res) => {
        if (err) {
            console.log(err)
            return cb(sendResponse(500, "Something went wrong", "archiveMarketTransactions", err, null))
        }
        console.log(res?.insertedCount)
        return cb(null, sendResponse(200, "Success", "archiveMarketTransactions", null, null))
    })
}
exports.archiveMarketTransactions = archiveMarketTransactions

/**
 * The function creates an Excel sheet with data from an input object, organized by strategy type.
 * @param data - The data object containing the transaction details.
 * @param response
 * @param cb
 * @returns a callback function with either an error or a success response object containing a status
 * code, message, function name, an Excel workbook object, and a null value.
 */
const createExcelData = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    console.log("Creating  Excel-------------------------------------------------------------------------------------------")

    let allTransactions = data.data

    let strategyObject = {
        "VOLUME": [],
        "SPREAD": [],
        "BULKORDER": [],
    }


    for (let j = 0; j < allTransactions.length; j++) {
        let order = allTransactions[j]
        if (order.status !== 'FILLED') {
            continue
        }
        let objToPush = {
            "orderId": order.orderId,
            "createdAt": order.createdAt,
            "symbol": order.clientDetails?.token + "_" + order.clientDetails?.baseToken,
            "fillPrice": order.fillPrice?.["$numberDecimal"],
            "fillQuantity": order.fillQuantity?.["$numberDecimal"],
            "price": order.price?.["$numberDecimal"],
            "quantity": order.quantity?.["$numberDecimal"],
            "status": order.status,
            "strategyType": order.strategyType,
            "totalPrice": order.totalPrice?.["$numberDecimal"],
            "transactionFee": order.transactionFee?.["$numberDecimal"],
            "feeType": order.feeType,
            "type": order.type,
            "accountUsed": order.account?.["$numberDecimal"] ? "Secondary" : "Primary"
        }

        strategyObject[order.strategyType].push(objToPush)
    }
    try {
        const workbook = new ExcelJS.Workbook();
        let columns = [
            { header: "Order Id", key: "orderId", width: 40 },
            { header: "Date", key: "createdAt", width: 30 },
            { header: "Symbol", key: "symbol", width: 15 },
            { header: "Fill Price", key: "fillPrice", width: 15 },
            { header: "Fill Amount", key: "fillQuantity", width: 15 },
            { header: "Price", key: "price", width: 15 },
            { header: "Amount", key: "quantity", width: 15 },
            { header: "Status", key: "status", width: 10 },
            { header: "Strategy Type", key: "strategyType", width: 15 },
            { header: "Total Price", key: "totalPrice", width: 20 },
            { header: "Txn Fees", key: "transactionFee", width: 15 },
            { header: "Fee Currency", key: "feeType", width: 10 },
            { header: "Side", key: "type", width: 10 },
            { header: "Account", key: "accountUsed", width: 15 },
            // { header: "Date", key: "orderUpdatedAt", width: 30 },
        ];


        const volumeSheet = workbook.addWorksheet('Volume');
        volumeSheet.columns = columns

        volumeSheet.addRows(strategyObject['VOLUME']);
        volumeSheet.getRow(1).font = { bold: true }

        const bulkOrderSheet = workbook.addWorksheet('BULKORDER');
        bulkOrderSheet.columns = columns

        bulkOrderSheet.addRows(strategyObject['BULKORDER']);
        bulkOrderSheet.getRow(1).font = { bold: true }

        const spreadSheet = workbook.addWorksheet('Spread');
        spreadSheet.columns = columns

        spreadSheet.addRows(strategyObject['SPREAD']);
        spreadSheet.getRow(1).font = { bold: true }
        // console.log("transactionSpreadData++++++++++++++++++++++++++>", transactionSpreadData)
        return cb(null, sendResponse(200, "Data Manipulated For Excel Sheet", "createExcelData", workbook, null))
    }
    catch (err) {
        console.log("Error while creating Excel +++++++++=>", err)
        return cb(sendResponse(500, "Error while creating Excel", "createExcelData", null, null))
    }

}

/**
 * This function saves an Excel workbook locally in a specified folder with a given file name.
 * @param data - An object containing information about the report path and file name.
 * @param response 
 * @param cb
 * @returns a Promise that resolves with the result of the `cb` function call, which is an object with
 * a status code, a message, a function name, and some additional data.
 */
const saveExcelLocally = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let workbook = response.data
    let folderName = __dirname + data.reportPath
    console.log(folderName)
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName, { recursive: true });
    }
    let fileName = data.fileName

    await workbook.xlsx.writeFile(folderName + fileName);
    return cb(null, sendResponse(200, "Success", "saveExcelLocally", null, null))
}


/**
 * The function verifies a report query and sends a response with the report path and name if it
 * exists, or an error message if it does not.
 * @param data - An object containing the date, exchange, and pair for the report generation.
 * @param response - The response object that will be used to send the HTTP response back to the
 * client.
 * @param cb - cb stands for "callback function". It is a function that is passed as a parameter to
 * another function and is called back when the operation is complete. In this case, the callback
 * function is used to send a response back to the client after verifying the report query.
 * @returns The function `verifyReportQueryAndSend` is returning either an error response or a success
 * response. If any of the required fields (`date`, `exchange`, `pair`) are missing in the `data`
 * object, it returns an error response with status code 400 and a message "Provide all the required
 * field for report generation!". If the report file does not exist in the specified path, it returns an 
 * error response with status code 400 and a message "No such report exist, contact tech team for more details!".
 */
const verifyReportQueryAndSend = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.date || !data.exchange || !data.pair) {
        return cb(sendResponse(400, "Provide all the required field for report generation!", "verifyReportQueryAndSend", null, null))
    }
    let client = `${data.exchange.toUpperCase()}_${data.pair.toUpperCase()}`
    let reportName = `${client}_${data.date}.xls`
    let reportPath = __dirname + `/reports/${client}/${reportName}`
    console.log(reportPath)
    if (!fs.existsSync(reportPath)) {
        return cb(sendResponse(400, "No such report exist, contact tech team for more details!", "verifyReportQueryAndSend", null, null))
    }
    let sendRes = {
        reportPath,
        reportName
    }
    return cb(null, sendResponse(200, "Success", "verifyReportQueryAndSend", sendRes, null))
}
exports.verifyReportQueryAndSend = verifyReportQueryAndSend



connectWithRetry();