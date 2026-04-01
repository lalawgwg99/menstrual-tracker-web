const APP_LOCK_KEY = 'app-lock-enabled'
const CRED_ID_KEY = 'app-lock-credential-id'

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : ''
  const str = atob(base64 + pad)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes.buffer
}

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return arr
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window
}

export function isAppLockEnabled(): boolean {
  return localStorage.getItem(APP_LOCK_KEY) === 'true'
}

export async function enableAppLock(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false

  const challenge = randomBytes(32)
  const userId = randomBytes(16)

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: '週期日記' },
      user: {
        id: userId,
        name: 'user',
        displayName: 'user'
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { userVerification: 'required' },
      timeout: 60000,
      attestation: 'none'
    }
  }) as PublicKeyCredential | null

  if (!credential) return false

  const id = bufferToBase64Url(credential.rawId)
  localStorage.setItem(CRED_ID_KEY, id)
  localStorage.setItem(APP_LOCK_KEY, 'true')
  return true
}

export function disableAppLock() {
  localStorage.setItem(APP_LOCK_KEY, 'false')
}

export async function unlockApp(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  const id = localStorage.getItem(CRED_ID_KEY)
  if (!id) return false

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        { type: 'public-key', id: base64UrlToBuffer(id) }
      ],
      userVerification: 'required',
      timeout: 60000
    }
  }) as PublicKeyCredential | null

  return !!assertion
}
