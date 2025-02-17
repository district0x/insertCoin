export function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isZeroAddress(address: string) {
  return address === "0x0000000000000000000000000000000000000000";
}

export function filterValidAddresses(
  addresses: `0x${string}`[]
): `0x${string}`[] {
  return addresses.filter(
    (addr): addr is `0x${string}` => !isZeroAddress(addr)
  );
}
