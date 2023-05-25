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
exports.sendResponse = sendResponse