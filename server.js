const bodyParser = require('body-parser');
const PORT = 8000;
const express = require('express');
const app = express();

require("./config")
const helper = require('./helper');

app.use(bodyParser.json({
    limit: "1000mb"
}));
app.use(bodyParser.urlencoded({
    extended: false, limit: "1000mb"
}));

app.post('/report', function (req, res) {
    let data = JSON.parse(req.body?.marketTransaction);
    helper.processReportData(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    })
})

//TODO
app.get('/download/report', function (req, res) {

    let data = req.query;
    data.req = req.data;
    helper.verifyReportQueryAndSend(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;

        const { reportPath, reportName } = response.data

        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.set('Content-Disposition', `attachment; filename=${reportName}`);
    
        return res.status(status).sendFile(reportPath);
    })
})

app.listen(PORT, (err, res) => {
    if (err) {
        console.log("Unable to start", err)
    }
    console.log(`server started on port: ${PORT}`);

});