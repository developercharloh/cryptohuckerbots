import VipPackages from "@/pages/VipPackages";

/**
 * The AI Signals tab is the VIP access screen.
 * The /bots route remains for compatibility with existing navigation links,
 * but no bot or marketplace UI is rendered here.
 */
export default function Bots() {
  return <VipPackages showBack={false} />;
}