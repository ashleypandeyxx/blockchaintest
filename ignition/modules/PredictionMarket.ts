import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the PredictionMarket.
 *
 * Both constructor arguments are Ignition parameters, so a deployment can be
 * pointed at a real treasury without editing this file:
 *
 *   npx hardhat ignition deploy ignition/modules/PredictionMarket.ts \
 *     --parameters ignition/parameters.json --network sepolia
 *
 * With no parameters supplied, fees accrue to the deploying account and the
 * protocol fee is 2%.
 */
export default buildModule("PredictionMarketModule", (m) => {
  const treasury = m.getParameter("treasury", m.getAccount(0));
  const feeBps = m.getParameter("feeBps", 200);

  const predictionMarket = m.contract("PredictionMarket", [treasury, feeBps]);

  return { predictionMarket };
});
