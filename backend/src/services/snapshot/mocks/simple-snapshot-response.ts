/**
 * Mock response for the simple-snapshot network.
 * Used when the snapshot server is unavailable for demo purposes.
 */

import { ScenarioOkResponse } from "../types";

export const simpleSnapshotMockResponse: ScenarioOkResponse = {
  data: {
    "source|branch-1|inlet_pressure": {
      pascal: 3000000,
      bara: 30.000000000000004,
      psi: 435.09789702683105,
      barg: 28.986750000000004,
      psf: 62654.09717186367,
    },
    "source|branch-1|inlet_temperature": {
      kelvin: 328.15,
      celsius: 55,
    },
    "source|branch-1|inlet_flowrate": {
      kgps: 31.68808781402895,
      mtpa: 1,
      kgPerDay: 2737850.787132101,
      tonnePerHour: 114.07711613050422,
    },
    "source|branch-1|inlet_density": {
      kgPerM3: 55.01488494873047,
      lbPerFt3: 3.434459215827354,
    },
    "source|branch-1|inlet_enthalpy": {
      jPerKg: 1085.3104893627903,
      kjPerKg: 1.0853104893627903,
    },
    "source|branch-1|inlet_entropy": {
      jPerK: -611.419873280754,
      kjPerK: -0.611419873280754,
    },
    "source|branch-1|inlet_molarMass": {
      scalar: 44.0098,
    },
    "source|branch-1|inlet_molarVolume": {
      m3PerMol: 0.0007999616838427211,
      m3PerKMol: 0.7999616838427211,
    },
    "source|branch-1|inlet_viscosity": {
      pascalSecond: 0.00001662691283854656,
    },
    "source|branch-1|inlet_volumetricFlowrate": {
      m3PerS: 0.575991167546015,
      m3PerH: 2073.568203165654,
    },
    "source|branch-1|inlet_vapourFraction": {
      scalar: 1,
    },
    "source|branch-1|inlet_carbonDioxideFraction": {
      molFraction: 1,
      molPercent: 100,
    },
    "source|branch-1|enabled": {
      boolean: true,
    },
    "valve|branch-1|inlet_pressure": {
      pascal: 3000000,
      bara: 30.000000000000004,
      psi: 435.09789702683105,
      barg: 28.986750000000004,
      psf: 62654.09717186367,
    },
    "valve|branch-1|inlet_temperature": {
      kelvin: 328.15,
      celsius: 55,
    },
    "valve|branch-1|inlet_flowrate": {
      kgps: 31.68808781402895,
      mtpa: 1,
      kgPerDay: 2737850.787132101,
      tonnePerHour: 114.07711613050422,
    },
    "valve|branch-1|inlet_density": {
      kgPerM3: 55.01488494873047,
      lbPerFt3: 3.434459215827354,
    },
    "valve|branch-1|inlet_enthalpy": {
      jPerKg: 1085.3104893627903,
      kjPerKg: 1.0853104893627903,
    },
    "valve|branch-1|inlet_entropy": {
      jPerK: -611.419873280754,
      kjPerK: -0.611419873280754,
    },
    "valve|branch-1|inlet_molarMass": {
      scalar: 44.0098,
    },
    "valve|branch-1|inlet_molarVolume": {
      m3PerMol: 0.0007999616838427211,
      m3PerKMol: 0.7999616838427211,
    },
    "valve|branch-1|inlet_viscosity": {
      pascalSecond: 0.00001662691283854656,
    },
    "valve|branch-1|inlet_volumetricFlowrate": {
      m3PerS: 0.575991167546015,
      m3PerH: 2073.568203165654,
    },
    "valve|branch-1|inlet_vapourFraction": {
      scalar: 1,
    },
    "valve|branch-1|inlet_carbonDioxideFraction": {
      molFraction: 1,
      molPercent: 100,
    },
    "valve|branch-1|outlet_pressure": {
      pascal: 2122070.312500001,
      bara: 21.22070312500001,
      psi: 307.76944343727354,
      barg: 20.20745312500001,
      psf: 44318.79985496739,
    },
    "valve|branch-1|outlet_temperature": {
      kelvin: 320.0271911621094,
      celsius: 46.8771911621094,
    },
    "valve|branch-1|outlet_flowrate": {
      kgps: 31.68808781402895,
      mtpa: 1,
      kgPerDay: 2737850.787132101,
      tonnePerHour: 114.07711613050422,
    },
    "valve|branch-1|outlet_density": {
      kgPerM3: 38.375057220458984,
      lbPerFt3: 2.3956710815905975,
    },
    "valve|branch-1|outlet_enthalpy": {
      jPerKg: 1085.3104893627903,
      kjPerKg: 1.0853104893627903,
    },
    "valve|branch-1|outlet_entropy": {
      jPerK: -551.6349050132327,
      kjPerK: -0.5516349050132326,
    },
    "valve|branch-1|outlet_molarMass": {
      scalar: 44.0098,
    },
    "valve|branch-1|outlet_molarVolume": {
      m3PerMol: 0.001146833469124756,
      m3PerKMol: 1.1468334691247561,
    },
    "valve|branch-1|outlet_viscosity": {
      pascalSecond: 0.000016156360288732685,
    },
    "valve|branch-1|outlet_volumetricFlowrate": {
      m3PerS: 0.8257469853917249,
      m3PerH: 2972.6891474102094,
    },
    "valve|branch-1|outlet_vapourFraction": {
      scalar: 1,
    },
    "valve|branch-1|outlet_carbonDioxideFraction": {
      molFraction: 1,
      molPercent: 100,
    },
    "valve|branch-1|enabled": {
      boolean: true,
    },
    "valve|branch-1|minimumUpstreamPressure": {
      pascal: 0,
      bara: 0,
      psi: 0,
      barg: -1.01325,
      psf: 0,
    },
    "reservoir|branch-1|inlet_pressure": {
      pascal: 1998986.7866777992,
      bara: 19.989867866777992,
      psi: 289.918315689311,
      barg: 18.976617866777993,
      psf: 41748.23745926078,
    },
    "reservoir|branch-1|inlet_temperature": {
      kelvin: 317.12530517578125,
      celsius: 43.97530517578127,
    },
    "reservoir|branch-1|inlet_flowrate": {
      kgps: 31.68808781402895,
      mtpa: 1,
      kgPerDay: 2737850.787132101,
      tonnePerHour: 114.07711613050422,
    },
    "reservoir|branch-1|inlet_density": {
      kgPerM3: 36.63250732421875,
      lbPerFt3: 2.2868874940986204,
    },
    "reservoir|branch-1|inlet_enthalpy": {
      jPerKg: -784.1223944604062,
      kjPerKg: -0.7841223944604062,
    },
    "reservoir|branch-1|inlet_entropy": {
      jPerK: -546.9123646137834,
      kjPerK: -0.5469123646137835,
    },
    "reservoir|branch-1|inlet_molarMass": {
      scalar: 44.0098,
    },
    "reservoir|branch-1|inlet_molarVolume": {
      m3PerMol: 0.0012013865065387953,
      m3PerKMol: 1.2013865065387954,
    },
    "reservoir|branch-1|inlet_viscosity": {
      pascalSecond: 0.00001600174800842069,
    },
    "reservoir|branch-1|inlet_volumetricFlowrate": {
      m3PerS: 0.8650264513310857,
      m3PerH: 3114.0952247919085,
    },
    "reservoir|branch-1|inlet_vapourFraction": {
      scalar: 1,
    },
    "reservoir|branch-1|inlet_carbonDioxideFraction": {
      molFraction: 1,
      molPercent: 100,
    },
    "reservoir|branch-1|enabled": {
      boolean: true,
    },
  },
  metadata: {},
  report: `# Network State Report
**Network | 01/30/2026 11:24:48**

# Subnet: branch-1
**Pressure Status: Ok**

Number containing two phase fluid: 0
Number where fluid properties out of data bounds: 0
### Start: Source: Source
- Fluid Pressure (bara): 30.000000000000004
- Fluid Flowrate (kg/s): 31.68808781402895
- Fluid Temperature (ºC): 55
- Fluid Enthalpy (kJ/kg): 1.0853104893627903
- Fluid Phase: Gas
- *** FluidComposition
- CarbonDioxide: 1
### Valve: valve
- IsEnabled: **True**
- Fluid Pressure (bara): 30.000000000000004
- Fluid Flowrate (kg/s): 31.68808781402895
- Fluid Temperature (ºC): 55
- Fluid Enthalpy (kJ/kg): 1.0853104893627903
- Fluid Phase: Gas

**Valve Outlet Fluid:**
- Outlet Fluid Pressure (bara): 21.22070312500001
- Outlet Fluid Flowrate (kg/s): 31.68808781402895
- Outlet Fluid Temperature (ºC): 46.8771911621094
- Outlet Fluid Enthalpy (kJ/kg): 1.0853104893627903
- Outlet Fluid Phase: Gas
### End: Reservoir: Reservoir
- Reservoir Pressure (bara) 20
- *** FluidComposition
- CarbonDioxide: 1
- Fluid Pressure (bara): 19.989867866777992
- Fluid Flowrate (kg/s): 31.68808781402895
- Fluid Temperature (ºC): 43.97530517578127
- Fluid Enthalpy (kJ/kg): -0.7841223944604062
- Fluid Phase: Gas`,
  thresholds: {
    maxWaterContentInPipeline: {
      molFraction: 0,
      molPercent: 0,
    },
    minTemperatureInPipeline: {
      kelvin: 0,
      celsius: -273.15,
    },
    maxPressureInOffshorePipeline: {
      pascal: 0,
      bara: 0,
      psi: 0,
      barg: -1.01325,
      psf: 0,
    },
    maxPressureInOnshore: {
      pascal: 0,
      bara: 0,
      psi: 0,
      barg: -1.01325,
      psf: 0,
    },
    temperatureInWell: {
      kelvin: 0,
      celsius: -273.15,
    },
    corrosionPotential: 0,
  },
  error: undefined,
};
