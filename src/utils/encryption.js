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
  await ready;

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
