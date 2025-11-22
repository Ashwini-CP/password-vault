import CryptoJS from 'crypto-js';

const secretKey = "300804"; 

export function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
}

export function decryptData(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}
