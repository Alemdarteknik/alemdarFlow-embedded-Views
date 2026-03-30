// Total Daily Energy
export function calculateTotalDailyEnergy(dailyPowerData: number[]) {
  // console.log("Calculating total daily energy with data:", dailyPowerData);
  const intervalHours = 5 / 60; // 5 minutes = 1/12 hour
  return dailyPowerData
    .reduce((sum, power) => sum + power * intervalHours, 0)
    .toFixed(1);
}

//  Grid Input Power
export function calculateGridInputPower(
  batteryVoltage: number,
  batteryDischargeCurrent: number,
  batteryChargeCurrent: number,
  outputPower: number,
  pvPower: number,
) {
  const actualBatteryPower =
    batteryVoltage * (batteryDischargeCurrent + batteryChargeCurrent);
  const calculatedGridPower = outputPower - pvPower - actualBatteryPower;
  const currentGridPower =
    calculatedGridPower / 1000 < 0 ? 0 : calculatedGridPower / 1000;
  return currentGridPower.toFixed(2);
}

// Battery Power and Charging State
export function calculateBatteryPowerAndChargingState(
  batteryVoltage: number,
  batteryDischargeCurrent: number,
  batteryChargeCurrent: number,
  systemStatus: string = "online",
) {
  let currentBatteryPower;
  let isCharging;
  let isDischarging;
  // console.log(
  //   "Calculating battery power and state with:",
  //   systemStatus)
  if (systemStatus === "offline") {
    currentBatteryPower = "0.00";
    isCharging = false;
    isDischarging = false;
    return { currentBatteryPower, isCharging, isDischarging };
  }

  if (batteryDischargeCurrent < batteryChargeCurrent) {
    currentBatteryPower = `+${(
      (batteryVoltage * batteryChargeCurrent) /
      1000
    ).toFixed(2)}`;
    isCharging = true;
    isDischarging = false;
  } else if (batteryDischargeCurrent === batteryChargeCurrent) {
    currentBatteryPower = "0.00";
    
    isCharging = true;
    isDischarging = false;

  }
  else{
    currentBatteryPower = (
      (-1 * batteryVoltage * batteryDischargeCurrent) /
      1000
    ).toFixed(2);
    isCharging = false;
    isDischarging = batteryDischargeCurrent > 0 ? true : false;
  }
  return { currentBatteryPower, isCharging, isDischarging };
}

// calculate the efficiency of the system
export function calculateEfficiency(
  outputPower: number,
  pvPower: number,
  gridInputPower: number = 0,
) {
  if (pvPower === 0) return 0; // Avoid division by zero
  const efficiency = ((outputPower - gridInputPower) / pvPower) * 100;
  return efficiency.toFixed(2);
}

// Calculate client savings using self-supplied energy (load - grid import)
export function calculateClientSavings(
  loadPowerData: number[],
  gridPowerData: number[],
  pricePerKwh: number = 13.8069,
  intervalMinutes: number = 5,
) {
  const intervalHours = intervalMinutes / 60;
  const sampleCount = Math.min(loadPowerData.length, gridPowerData.length);

  let loadEnergyKwh = 0;
  let gridEnergyKwh = 0;
  let selfSuppliedEnergyKwh = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const loadPowerKw = Number.isFinite(loadPowerData[index])
      ? loadPowerData[index]
      : 0;
    const gridPowerKw = Number.isFinite(gridPowerData[index])
      ? gridPowerData[index]
      : 0;

    const safeLoadPowerKw = Math.max(0, loadPowerKw);
    const safeGridPowerKw = Math.max(0, gridPowerKw);
    const selfSuppliedPowerKw = Math.max(safeLoadPowerKw - safeGridPowerKw, 0);

    loadEnergyKwh += safeLoadPowerKw * intervalHours;
    gridEnergyKwh += safeGridPowerKw * intervalHours;
    selfSuppliedEnergyKwh += selfSuppliedPowerKw * intervalHours;
  }

  const savingsTl = selfSuppliedEnergyKwh * pricePerKwh;

  return {
    loadEnergyKwh,
    gridEnergyKwh,
    selfSuppliedEnergyKwh,
    savingsTl,
    pricePerKwh,
  };
}

export const calculateTotalSolarPower = (pv1Power: number, pv2Power: number) => {
  return ((pv1Power + pv2Power) / 1000).toFixed(2);
};