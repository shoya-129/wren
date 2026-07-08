import {
  ready,
  randombytes_buf,
  crypto_pwhash,
  crypto_pwhash_SALTBYTES,
  crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES,
  crypto_pwhash_OPSLIMIT_INTERACTIVE,
  crypto_pwhash_MEMLIMIT_INTERACTIVE,
  crypto_pwhash_ALG_DEFAULT,
  crypto_box_seed_keypair,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  to_string,
  crypto_box_seal,
  crypto_box_seal_open
} from "react-native-libsodium";
import { fromByteArray, toByteArray } from "base64-js";
import { AES } from "@stablelib/aes";
import { GCM } from "@stablelib/gcm";





export async function createMasterKey(password) {
  await ready;

  const salt = randombytes_buf(crypto_pwhash_SALTBYTES);

  const masterKey = crypto_pwhash(
    crypto_secretbox_KEYBYTES,
    password,
    salt,
    crypto_pwhash_OPSLIMIT_INTERACTIVE,
    crypto_pwhash_MEMLIMIT_INTERACTIVE,
    crypto_pwhash_ALG_DEFAULT
  );

  return {
    masterKey: fromByteArray(masterKey),
    salt: fromByteArray(salt),
  };
}

export async function deriveMasterKey(password, saltBase64) {
  await ready;

  const salt = toByteArray(saltBase64);

  const masterKey = crypto_pwhash(
    crypto_secretbox_KEYBYTES,
    password,
    salt,
    crypto_pwhash_OPSLIMIT_INTERACTIVE,
    crypto_pwhash_MEMLIMIT_INTERACTIVE,
    crypto_pwhash_ALG_DEFAULT
  );

  return {
    masterKey: fromByteArray(masterKey),
  };
}

export async function generateKeyPair(masterKeyBase64) {
  await ready;

  const seed = toByteArray(masterKeyBase64);
  const { publicKey, privateKey } = crypto_box_seed_keypair(seed);

  return {
    publicKey: fromByteArray(publicKey),
    privateKey: fromByteArray(privateKey),
  };
}

export async function generateFeedKey() {
  await ready;
  const feedKey = randombytes_buf(32);
  return fromByteArray(feedKey);
}

export async function encryptData(content, keyBase64) {
  await ready;

  const key = toByteArray(keyBase64);
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const ciphertext = crypto_secretbox_easy(content, nonce, key);

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return fromByteArray(combined);
}

export async function decryptData(encryptedBase64, keyBase64) {
  if (!encryptedBase64) return "";
  await ready;

  // Automatically decrypt AES-256-GCM binary file URL from Cloudinary (or local uri)
  if (
    typeof encryptedBase64 === "string" &&
    (encryptedBase64.startsWith("http://") ||
      encryptedBase64.startsWith("https://") ||
      encryptedBase64.startsWith("file://") ||
      encryptedBase64.startsWith("content://") ||
      encryptedBase64.endsWith(".wren") ||
      encryptedBase64.endsWith(".enc"))
  ) {
    return decryptMediaBinary(encryptedBase64, keyBase64);
  }

  const key = toByteArray(keyBase64);
  const combined = toByteArray(encryptedBase64);

  if (combined.length < crypto_secretbox_NONCEBYTES) {
    throw new Error("Invalid encrypted data length");
  }

  const nonce = combined.slice(0, crypto_secretbox_NONCEBYTES);
  const ciphertext = combined.slice(crypto_secretbox_NONCEBYTES);

  const decryptedBytes = crypto_secretbox_open_easy(ciphertext, nonce, key);
  return to_string(decryptedBytes);
}

export async function encryptAsymmetric(content, publicKeyBase64) {
  await ready;

  const publicKey = toByteArray(publicKeyBase64);
  const ciphertext = crypto_box_seal(content, publicKey);

  return fromByteArray(ciphertext);
}

export async function decryptAsymmetric(encryptedBase64, publicKeyBase64, privateKeyBase64) {
  await ready;

  if (!encryptedBase64 || !publicKeyBase64 || !privateKeyBase64) {
    throw new Error(
      "decryptAsymmetric requires (encryptedBase64, publicKeyBase64, privateKeyBase64)"
    );
  }

  const ciphertext = toByteArray(encryptedBase64);
  const publicKey = toByteArray(publicKeyBase64);
  const privateKey = toByteArray(privateKeyBase64);

  const decryptedBytes = crypto_box_seal_open(ciphertext, publicKey, privateKey);
  return to_string(decryptedBytes);
}

export async function encryptMediaBinary(base64Image, keyBase64) {
  await ready;

  const keyBytes = toByteArray(keyBase64);
  const imageBytes = toByteArray(base64Image);
  const iv = randombytes_buf(12);

  const aes = new AES(keyBytes);
  const gcm = new GCM(aes);

  const sealed = gcm.seal(iv, imageBytes);

  const combined = new Uint8Array(iv.length + sealed.length);
  combined.set(iv, 0);
  combined.set(sealed, iv.length);

  return combined;
}

const mediaCache = new Map();

export async function decryptMediaBinary(encryptedBase64OrUrl, keyBase64) {
  const cacheKey = `${encryptedBase64OrUrl}_${keyBase64}`;
  if (mediaCache.has(cacheKey)) {
    return mediaCache.get(cacheKey);
  }

  await ready;

  const keyBytes = toByteArray(keyBase64);
  let combined;

  if (typeof encryptedBase64OrUrl === "string" && (encryptedBase64OrUrl.startsWith("http://") || encryptedBase64OrUrl.startsWith("https://"))) {
    const res = await fetch(encryptedBase64OrUrl);
    const arrayBuffer = await res.arrayBuffer();
    combined = new Uint8Array(arrayBuffer);
  } else {
    combined = toByteArray(encryptedBase64OrUrl);
  }

  if (combined.length < 12 + 16) {
    throw new Error("Invalid encrypted media data length");
  }

  const iv = combined.slice(0, 12);
  const sealed = combined.slice(12);

  const aes = new AES(keyBytes);
  const gcm = new GCM(aes);

  const decryptedBytes = gcm.open(iv, sealed);
  if (!decryptedBytes) {
    throw new Error("AES-256-GCM Decryption/Authentication failed");
  }

  // Detect mime type
  let mime = "image/jpeg";
  if (decryptedBytes.length > 4) {
    if (decryptedBytes[0] === 0x89 && decryptedBytes[1] === 0x50 && decryptedBytes[2] === 0x4E && decryptedBytes[3] === 0x47) {
      mime = "image/png";
    } else if (decryptedBytes[0] === 0xFF && decryptedBytes[1] === 0xD8 && decryptedBytes[2] === 0xFF) {
      mime = "image/jpeg";
    } else if (decryptedBytes[0] === 0x47 && decryptedBytes[1] === 0x49 && decryptedBytes[2] === 0x46 && decryptedBytes[3] === 0x38) {
      mime = "image/gif";
    }
  }

  const base64String = fromByteArray(decryptedBytes);
  const dataUri = `data:${mime};base64,${base64String}`;
  mediaCache.set(cacheKey, dataUri);
  return dataUri;
}
