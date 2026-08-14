export const BROKER_OPTIONS = [
  "Zerodha",
  "Groww",
  "HDFC Securities",
  "ICICI Direct",
  "Kotak Securities",
  "Axis Direct",
  "Angel One",
  "Upstox",
  "Dhan",
  "INDmoney",
  "Motilal Oswal",
  "SBI Securities",
  "Sharekhan",
  "CAMS / KFintech",
  "MF Central",
  "Physical custody",
] as const;

export function BrokerOptions({ id }: { id: string }) {
  return <datalist id={id}>{BROKER_OPTIONS.map((broker) => <option key={broker} value={broker} />)}</datalist>;
}
