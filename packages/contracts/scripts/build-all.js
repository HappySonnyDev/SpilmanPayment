#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Copy deployment configurations to shared package
 * This allows webapp to access the latest contract deployment info
 */
function copyDeploymentToShared() {
  console.log('\n📋 Copying deployment configurations to shared package...');
  
  const deploymentDir = path.join(process.cwd(), 'deployment');
  const sharedDeploymentDir = path.join(process.cwd(), '../shared/src/deployment');
  
  // Create shared deployment directory if it doesn't exist
  if (!fs.existsSync(sharedDeploymentDir)) {
    fs.mkdirSync(sharedDeploymentDir, { recursive: true });
  }
  
  try {
    // Copy system-scripts.json
    const systemScriptsPath = path.join(deploymentDir, 'system-scripts.json');
    const targetSystemScriptsPath = path.join(sharedDeploymentDir, 'system-scripts.json');
    if (fs.existsSync(systemScriptsPath)) {
      fs.copyFileSync(systemScriptsPath, targetSystemScriptsPath);
      console.log('  ✓ Copied system-scripts.json');
    }
    
    // Copy scripts.json
    const scriptsPath = path.join(deploymentDir, 'scripts.json');
    const targetScriptsPath = path.join(sharedDeploymentDir, 'scripts.json');
    if (fs.existsSync(scriptsPath)) {
      fs.copyFileSync(scriptsPath, targetScriptsPath);
      console.log('  ✓ Copied scripts.json');
    }
    
    console.log('✅ Deployment configurations copied successfully!');
  } catch (error) {
    console.error('⚠️  Warning: Failed to copy deployment configurations:', error.message);
  }
}

function buildAllContracts() {
  const contractsDir = path.join(process.cwd(), 'contracts');

  if (!fs.existsSync(contractsDir)) {
    console.error('No contracts directory found!');
    process.exit(1);
  }

  const contracts = fs
    .readdirSync(contractsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (contracts.length === 0) {
    console.log('No contracts found to build.');
    return;
  }

  console.log(`Building ${contracts.length} contract(s): ${contracts.join(', ')}`);

  for (const contractName of contracts) {
    console.log(`\n📦 Building contract: ${contractName}`);
    try {
      execSync(`node scripts/build-contract.js ${contractName}`, { stdio: 'inherit' });
      console.log(`✅ Successfully built: ${contractName}`);
    } catch (error) {
      console.error(`❌ Failed to build: ${contractName}`);
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log(`\n🎉 All contracts built successfully!`);
  
  // Copy deployment configurations to shared package
  copyDeploymentToShared();
}

buildAllContracts();
