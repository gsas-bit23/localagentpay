import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { CheckoutError } from "./brij";
import type { BookingSession } from "./session";
import { SOLANA_MAINNET, USDC_MINT } from "./types";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const COMPUTE = "ComputeBudget111111111111111111111111111111",
  MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export async function validateSignedPayment(
  encoded: string,
  session: BookingSession,
) {
  try {
    const payment = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    const expected = (session.requirements.accepts as any[])[0],
      actual = payment.accepted;
    if (
      payment.x402Version !== 2 ||
      payment.resource?.url !== (session.requirements.resource as any).url ||
      payment.extensions?.["payment-identifier"]?.info?.id !== session.paymentId
    )
      throw Error();
    for (const key of ["scheme", "network", "asset", "amount", "payTo"])
      if (actual?.[key] !== expected[key]) throw Error();
    if (
      actual.network !== SOLANA_MAINNET ||
      actual.asset !== USDC_MINT ||
      actual.extra?.feePayer !== expected.extra.feePayer
    )
      throw Error();
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(payment.payload.transaction, "base64"),
    );
    if (
      transaction.message.version !== 0 ||
      transaction.message.addressTableLookups.length
    )
      throw Error();
    const keys = transaction.message.staticAccountKeys;
    if (keys[0].toBase58() !== expected.extra.feePayer) throw Error();
    const source = (
      await PublicKey.findProgramAddress(
        [
          new PublicKey(session.wallet).toBytes(),
          TOKEN.toBytes(),
          new PublicKey(USDC_MINT).toBytes(),
        ],
        ATA,
      )
    )[0].toBase58();
    const destination = (
      await PublicKey.findProgramAddress(
        [
          new PublicKey(expected.payTo).toBytes(),
          TOKEN.toBytes(),
          new PublicKey(USDC_MINT).toBytes(),
        ],
        ATA,
      )
    )[0].toBase58();
    let transfers = 0;
    for (const ix of transaction.message.compiledInstructions) {
      const program = keys[ix.programIdIndex].toBase58();
      if (program === COMPUTE || program === MEMO) continue;
      if (
        program !== TOKEN.toBase58() ||
        ix.data.length !== 10 ||
        ix.data[0] !== 12 ||
        ix.data[9] !== 6
      )
        throw Error();
      const accounts = ix.accountKeyIndexes.map((index) =>
        keys[index].toBase58(),
      );
      if (
        accounts.length !== 4 ||
        accounts[0] !== source ||
        accounts[1] !== USDC_MINT ||
        accounts[2] !== destination ||
        accounts[3] !== session.wallet ||
        Buffer.from(ix.data).readBigUInt64LE(1).toString() !== expected.amount
      )
        throw Error();
      transfers++;
    }
    const signerIndex = keys.findIndex(
      (key) => key.toBase58() === session.wallet,
    );
    if (
      transfers !== 1 ||
      signerIndex < 0 ||
      signerIndex >= transaction.message.header.numRequiredSignatures ||
      !transaction.signatures[signerIndex]?.some((byte) => byte !== 0)
    )
      throw Error();
    if (
      !(await new PublicKey(session.wallet).verifySignature(
        transaction.signatures[signerIndex],
        transaction.message.serialize(),
      ))
    )
      throw Error();
    return payment;
  } catch {
    throw new CheckoutError(
      "The signed payment does not match the reviewed booking. It was not submitted.",
      400,
      "PAYMENT_MISMATCH",
    );
  }
}
