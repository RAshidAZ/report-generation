const bodyParser = require('body-parser');
const PORT = 8000;
const express = require('express');
const app = express();


const helper = require('./helper');

app.use(bodyParser.json({
    limit: "1000mb"
}));
app.use(bodyParser.urlencoded({
    extended: false, limit: "1000mb"
}));

app.post('/report', function (req, res) {
    let data = req.body;
    data.req = req.data;
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
// app.get('/download/report', function (req, res) {
//     let filePath = path.join(__dirname, "../../../")
//     let fileName = "rejson.Linux-ubuntu18.04-x86_64.2.0.11.zip"
//     res.setHeader('Content-type', 'application/zip');
//     res.set('Content-Disposition', `attachment; filename=${fileName}`);

//     res.sendFile(filePath + fileName);
// })

app.listen(PORT, (err, res) => {
    if (err) {
        console.log("Unable to start", err)
    }
    console.log(`server started on port: ${PORT}`);

});