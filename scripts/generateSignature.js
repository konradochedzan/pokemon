import { ethers, keccak256, solidityPacked } from "ethers";

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const signer = new ethers.Wallet(PRIVATE_KEY);

export async function generateSignature(
  userAddress,
  name,
  gender,
  pokemonType,
  spAttack,
  spDefense,
  level,
  hp,
  attack,
  defense,
  speed,
  purity
) {
  const packedData = solidityPacked(
    ["address", "string", "string", "string", "string", "string", "uint8", "uint8", "uint16", "uint16", "uint16", "uint8"],
    [userAddress, name, gender, pokemonType, spAttack, spDefense, level, hp, attack, defense, speed, purity]
  );

  const messageHash = keccak256(packedData);
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  return signature;
}
