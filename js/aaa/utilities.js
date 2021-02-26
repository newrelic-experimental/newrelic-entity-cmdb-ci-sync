async function encryptString(_string, _passphrase) {

    const CryptoJS = require("crypto-js");
    var __encryptedResult;

    __encryptedResult = CryptoJS.AES.encrypt(_string.toString(), _passphrase.toString()).toString();
    return(__encryptedResult);
} //encryptString

async function decryptString(_string, _passphrase) {

    const CryptoJS = require("crypto-js");
    var __decryptedResult;

    __decryptedResult = CryptoJS.AES.decrypt(_string.toString(), _passphrase.toString()).toString(CryptoJS.enc.Utf8);
    return(__decryptedResult);
} //decryptString

module.exports = {
    encryptString: encryptString,
    decryptString: decryptString   
};