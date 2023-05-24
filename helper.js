
const { MongoClient } = require('mongodb');
const async = require('async');
const ExcelJS = require('exceljs');
const fs = require('fs')

const sendResponse = function (status, message, action, data, signature) {
    let response = {};
    switch (status) {
        case 200: // status = 200
            response = {
                action: action,
                status: status,
                message: message,
                data: data,
                error: false,
            };
            break;
        case 500: // status = 500
            response = {
                action: action,
                status: status,
                message: message ? message : "Something went wrong",
                data: data,
                error: true,
            };
            break;
        case 400: // status = 400
            response = {
                signature: signature,
                action: action,
                status: status,
                message: message ? message : "Missing params",
                data: data,
                error: true,
            };
            break;
        default:
            response = {
                signature: signature,
                action: action,
                status: status,
                message: message,
                data: data,
                error: true,
            };
    }
    return response;
};

const url = 'mongodb://localhost:27017/';
const client = new MongoClient(url);
const Transactions = client.db('transactions')

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
connectWithRetry();



const processReportData = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let waterFallFunctions = []
    waterFallFunctions.push(async.apply(saveTransactionsInMongoDB, data))
    waterFallFunctions.push(async.apply(createExcelData, data))
    waterFallFunctions.push(async.apply(saveExcelLocally, data))
    async.waterfall(waterFallFunctions, cb)

}
exports.processReportData = processReportData

const saveTransactionsInMongoDB = (data, response, cb) => {
    if (!cb) {
        cb = response;
    }
    let collectionName = data.collectionName
    console.log(collectionName)
    const collection = Transactions.collection(collectionName);
    let insertArray = data.data
    collection.insertMany(insertArray, (err, res) => {
        if (err) {
            return cb(sendResponse(500, "Something went wrong", "saveTransactionsInMongoDB", err, null))
        }
        return cb(null, sendResponse(200, "Success", "saveTransactionsInMongoDB", res, null))
    })
}

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
            "fillPrice": order.fillPrice,
            "fillQuantity": order.fillQuantity,
            "price": order.price,
            "quantity": order.quantity,
            "status": order.status,
            "strategyType": order.strategyType,
            "totalPrice": order.totalPrice,
            "transactionFee": order.transactionFee,
            "feeType": order.feeType,
            "type": order.type,
            "accountUsed": order.account ? "Secondary" : "Primary"
        }

        strategyObject[order.strategyType].push(objToPush)
    }
    try {
        const workbook = new ExcelJS.Workbook();
        let columns = [
            { header: "Order Id", key: "orderId", width: 40 },
            { header: "Date", key: "createdAt", width: 30 },
            { header: "Symbol", key: "symbol", width: 15 },
            { header: "Fill Price", key: "fillPrice", width: 10 },
            { header: "Fill Amount", key: "fillQuantity", width: 10 },
            { header: "Price", key: "price", width: 10 },
            { header: "Amount", key: "quantity", width: 10 },
            { header: "Status", key: "status", width: 10 },
            { header: "Strategy Type", key: "strategyType", width: 10 },
            { header: "Total Price", key: "totalPrice", width: 10 },
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

const saveExcelLocally = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let workbook = response.data
    let folderName = data.reportPath
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName, { recursive: true });
    }
    let fileName = data.fileName

    await workbook.xlsx.writeFile(folderName + fileName);
    return cb(null, sendResponse(200, "Success", "saveExcelLocally", null, null))
}




