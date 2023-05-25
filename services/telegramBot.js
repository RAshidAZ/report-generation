const { sendResponse } = require('./sendResponse');

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);


/**
 * Function to send message to telegram channel
 * @param {*} data 
 * @param {*} response 
 * @param {*} cb 
 * @returns 
 */
const sendTelegramMessage = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let chatId = process.env.telegramChatId;

    let msgToSend = data.tgMessage;
    console.log("msgToSend---->", msgToSend)
    bot.sendMessage(chatId, text = msgToSend, { parse_mode: 'Markdown' }).then((res) => {
        console.log(res)
        return cb(null, sendResponse(200, "Notification Sent", "sendTelegramMessage", null, null));
    }).catch((err) => {
        console.log(err)
        return cb(null, sendResponse(200, "Telegram Notification Not Sent", "sendTelegramMessage", null, null));
    })
}
exports.sendTelegramMessage = sendTelegramMessage
