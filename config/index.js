// Fetching the environment
const env = process.env.NODE_ENV || 'development';

// Common Environment Variables
const commonVariables = {
    telegramChatId: "-1001804027669",
    TELEGRAM_BOT_TOKEN: "6020595406:AAGC7BEiBAE_abEIseZGrM7LFYlxrJYfcdk"
}

//setting the common variables
Object.keys(commonVariables).forEach((key) => {
    process.env[key] = commonVariables[key];
})
