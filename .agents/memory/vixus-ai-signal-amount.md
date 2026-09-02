---
name: VIXUS AI signal amount
description: Durable product decision for the fixed AI Signal stake and reward.
---

AI Signal execution and the disclosed Signal Reward are both fixed at $1.50. The amount is server-owned; clients must not be allowed to reintroduce a different stake, reward, or displayed outcome.

**Why:** The user explicitly narrowed the signal amount from $2.25 to $1.50, and a split between server settlement and UI copy would create incorrect wallet expectations.

**How to apply:** When changing signal behavior, update the server constants, bulk totals, client fallbacks, VIP/legal copy, wallet settlement assertions, and any related tests together. Do not change referral bonuses or unrelated trade amounts.