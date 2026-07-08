const { AES } = require("./node_modules/@stablelib/aes");
const { GCM } = require("./node_modules/@stablelib/gcm");

// Create a dummy 32-byte key
const key = new Uint8Array(32);
for (let i = 0; i < 32; i++) key[i] = i;

// Create dummy image data (100 bytes)
const plaintext = new Uint8Array(100);
for (let i = 0; i < 100; i++) plaintext[i] = i % 256;

// Create dummy 12-byte IV
const iv = new Uint8Array(12);
for (let i = 0; i < 12; i++) iv[i] = 100 + i;

console.log("Plaintext length:", plaintext.length);
console.log("IV length:", iv.length);

const aes = new AES(key);
const gcm = new GCM(aes);

// Encrypt
const sealed = gcm.seal(iv, plaintext);
console.log("Sealed (ciphertext + tag) length:", sealed.length); // Should be 100 + 16 = 116 bytes

// Combine IV + Sealed
const combined = new Uint8Array(iv.length + sealed.length);
combined.set(iv, 0);
combined.set(sealed, iv.length);
console.log("Combined payload length:", combined.length); // Should be 12 + 100 + 16 = 128 bytes

// Decrypt
const extractedIv = combined.slice(0, 12);
const extractedSealed = combined.slice(12);
console.log("Extracted IV length:", extractedIv.length);
console.log("Extracted Sealed length:", extractedSealed.length);

const decrypted = gcm.open(extractedIv, extractedSealed);
if (!decrypted) {
  console.error("Decryption failed!");
  process.exit(1);
}

console.log("Decrypted bytes length:", decrypted.length);
let match = true;
for (let i = 0; i < 100; i++) {
  if (decrypted[i] !== plaintext[i]) {
    match = false;
  }
}

if (match) {
  console.log("SUCCESS: Decrypted bytes match original plaintext perfectly!");
} else {
  console.error("FAILURE: Decrypted bytes do not match original plaintext!");
  process.exit(1);
}
