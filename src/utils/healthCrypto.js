import { encrypt as mmEncrypt } from "@metamask/eth-sig-util";

function bytesToBase64(bytes) {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

export function randomBytes(length) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

// AES-256-GCM with a per-record DEK
export async function encryptJsonWithDEK(jsonObj, dekBytes) {
  const iv = randomBytes(12);
  const key = await crypto.subtle.importKey("raw", dekBytes, "AES-GCM", false, ["encrypt"]);
  const plaintext = utf8ToBytes(JSON.stringify(jsonObj));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  return {
    ciphertextB64: bytesToBase64(ciphertext),
    ivB64: bytesToBase64(iv),
    algo: "AES-256-GCM",
  };
}

export async function decryptJsonWithDEK(ciphertextB64, ivB64, dekBytes) {
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ciphertextB64);
  const key = await crypto.subtle.importKey("raw", dekBytes, "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
  return JSON.parse(bytesToUtf8(plaintext));
}

// Encrypt a DEK for a recipient using their MetaMask encryption public key (x25519-xsalsa20-poly1305).
// The output is a hex string of the JSON payload MetaMask expects for eth_decrypt.
export function encryptDEKForPublicKey(dekBytes, recipientEncryptionPublicKey) {
  const msgB64 = bytesToBase64(dekBytes);
  const enc = mmEncrypt({
    publicKey: recipientEncryptionPublicKey,
    data: msgB64,
    version: "x25519-xsalsa20-poly1305",
  });
  const payloadJson = JSON.stringify(enc);
  const payloadHex =
    "0x" +
    Array.from(utf8ToBytes(payloadJson))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return payloadHex;
}

export async function decryptDEKWithWallet(encryptedPayloadHex, account) {
  if (!window.ethereum) throw new Error("MetaMask not available");
  const msg = await window.ethereum.request({
    method: "eth_decrypt",
    params: [encryptedPayloadHex, account],
  });
  // msg is base64 string (we encrypted base64 of the raw DEK)
  return base64ToBytes(msg);
}

