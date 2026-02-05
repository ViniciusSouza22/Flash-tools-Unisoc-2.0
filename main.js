const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

let mainWindow;

function createWindow() {
  console.log('🚀 Iniciando aplicação Electron...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#8a0880',
      symbolColor: '#ffffff'
    }
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Janela principal carregada e pronta');
  });
}

app.whenReady().then(() => {
  console.log('✅ Electron app está pronto');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('🔚 Todas as janelas fechadas - encerrando aplicação');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔗 App ativado');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Função para VERIFICAR se os arquivos essenciais já existem na pasta do firmware
function checkEssentialFiles(firmwareFolder) {
  console.log('🔍 VERIFICANDO ARQUIVOS ESSENCIAIS NA PASTA DO FIRMWARE');
  console.log(`📂 Pasta do firmware: ${firmwareFolder}`);
  
  const essentialFiles = [
    'spd_dump.exe',
    'fdl1-moto-java.bin', 
    'fdl2-moto-java.bin'
  ];
  
  let missingFiles = [];
  let existingFiles = [];
  
  essentialFiles.forEach(file => {
    const filePath = path.join(firmwareFolder, file);
    const exists = fs.existsSync(filePath);
    
    console.log(`   ${exists ? '✅' : '❌'} ${file} - ${exists ? 'PRESENTE' : 'AUSENTE'}`);
    
    if (exists) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  });
  
  console.log(`📊 RESUMO: ${existingFiles.length} presentes, ${missingFiles.length} ausentes`);
  
  return {
    success: missingFiles.length === 0,
    existingFiles: existingFiles,
    missingFiles: missingFiles,
    message: missingFiles.length === 0 
      ? 'Todos os arquivos essenciais estão presentes' 
      : `Arquivos ausentes: ${missingFiles.join(', ')}`
  };
}

// Função para encontrar a pasta spd_dump (apenas se necessário)
function findSPDFolder() {
  console.log('🔍 PROCURANDO PASTA SPD_DUMP...');
  
  const possiblePaths = [
    path.join(__dirname, 'spd_dump'),
    path.join(process.resourcesPath, 'spd_dump'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'spd_dump'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'spd_dump'),
  ];

  for (const spdPath of possiblePaths) {
    if (fs.existsSync(spdPath)) {
      console.log(`✅ SPD_DUMP ENCONTRADO: ${spdPath}`);
      return spdPath;
    }
  }

  console.log('❌ SPD_DUMP NÃO ENCONTRADO');
  return null;
}

// Função para copiar APENAS os arquivos que faltam
function copyMissingFiles(firmwareFolder) {
  console.log('📁 VERIFICANDO E COPIANDO ARQUIVOS FALTANTES');
  
  // Primeiro, verificar o que já existe
  const checkResult = checkEssentialFiles(firmwareFolder);
  
  if (checkResult.success) {
    console.log('🎯 TODOS OS ARQUIVOS JÁ ESTÃO PRESENTES - NADA PARA COPIAR');
    return { success: true, message: 'Arquivos já presentes', copied: 0 };
  }
  
  console.log(`📋 Arquivos faltantes: ${checkResult.missingFiles.join(', ')}`);
  
  // Se faltam arquivos, tentar copiar do spd_dump
  const spdFolder = findSPDFolder();
  if (!spdFolder) {
    return { 
      success: false, 
      message: 'Não foi possível encontrar os arquivos SPD para copiar' 
    };
  }
  
  let copiedCount = 0;
  let copyErrors = [];
  
  // Copiar apenas os arquivos que faltam
  checkResult.missingFiles.forEach(file => {
    const sourceFile = path.join(spdFolder, file);
    const destFile = path.join(firmwareFolder, file);
    
    console.log(`\n📄 Copiando: ${file}`);
    console.log(`   Origem: ${sourceFile}`);
    console.log(`   Destino: ${destFile}`);
    
    if (fs.existsSync(sourceFile)) {
      try {
        fs.copyFileSync(sourceFile, destFile);
        
        // Verificar se a cópia foi bem-sucedida
        if (fs.existsSync(destFile)) {
          console.log(`   ✅ COPIADO COM SUCESSO`);
          copiedCount++;
        } else {
          console.log(`   ❌ FALHA NA CÓPIA`);
          copyErrors.push(file);
        }
      } catch (error) {
        console.log(`   ❌ ERRO: ${error.message}`);
        copyErrors.push(file);
      }
    } else {
      console.log(`   ❌ ARQUIVO NÃO ENCONTRADO NA ORIGEM`);
      copyErrors.push(file);
    }
  });
  
  console.log(`\n📊 RESULTADO DA CÓPIA: ${copiedCount} arquivos copiados, ${copyErrors.length} erros`);
  
  if (copyErrors.length === 0) {
    return { 
      success: true, 
      message: `${copiedCount} arquivos copiados com sucesso`,
      copied: copiedCount
    };
  } else {
    return { 
      success: false, 
      message: `Erro ao copiar arquivos: ${copyErrors.join(', ')}`,
      copied: copiedCount
    };
  }
}

// IPC handlers
ipcMain.handle('select-firmware-folder', async () => {
  console.log('📂 IPC: select-firmware-folder chamado');
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Selecionar Pasta do Firmware',
      buttonLabel: 'Selecionar Pasta'
    });
    
    if (result.canceled) {
      console.log('👤 Usuário cancelou a seleção');
      return { canceled: true };
    }
    
    const folderPath = result.filePaths[0];
    console.log(`📂 Pasta selecionada: ${folderPath}`);
    
    const files = fs.readdirSync(folderPath);
    console.log(`📂 ${files.length} arquivos encontrados`);
    
    // Verificar arquivos essenciais imediatamente
    const essentialCheck = checkEssentialFiles(folderPath);
    console.log(`🔍 Status dos arquivos: ${essentialCheck.message}`);
    
    return {
      canceled: false,
      path: folderPath,
      files: files,
      essentialFilesStatus: essentialCheck
    };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle('run-firmware-flash', async (event, folderPath) => {
  console.log('⚡ IPC: run-firmware-flash chamado');
  console.log(`📂 Pasta do firmware: ${folderPath}`);
  
  return new Promise((resolve) => {
    console.log('🔄 INICIANDO PROCESSO DE FLASH');
    
    // PRIMEIRO: Verificar se os arquivos já estão presentes
    console.log('🔍 Etapa 1: Verificando arquivos essenciais...');
    const initialCheck = checkEssentialFiles(folderPath);
    
    if (initialCheck.success) {
      console.log('✅ TODOS OS ARQUIVOS JÁ ESTÃO PRESENTES - INICIANDO FLASH DIRETAMENTE');
      executeFlashProcess(folderPath, resolve);
      return;
    }
    
    console.log(`📋 Arquivos faltantes detectados: ${initialCheck.missingFiles.join(', ')}`);
    
    // SEGUNDO: Tentar copiar os arquivos faltantes
    console.log('📁 Etapa 2: Copiando arquivos faltantes...');
    const copyResult = copyMissingFiles(folderPath);
    
    if (!copyResult.success) {
      console.log(`❌ FALHA: ${copyResult.message}`);
      resolve({ success: false, output: copyResult.message });
      return;
    }
    
    console.log(`✅ ${copyResult.message}`);
    
    // TERCEIRO: Verificar novamente após a cópia
    console.log('🔍 Etapa 3: Verificação final...');
    const finalCheck = checkEssentialFiles(folderPath);
    
    if (!finalCheck.success) {
      console.log(`❌ FALHA: Ainda faltam arquivos: ${finalCheck.missingFiles.join(', ')}`);
      resolve({ success: false, output: `Arquivos essenciais não encontrados: ${finalCheck.missingFiles.join(', ')}` });
      return;
    }
    
    console.log('✅ TODOS OS ARQUIVOS CONFIRMADOS - INICIANDO FLASH');
    executeFlashProcess(folderPath, resolve);
  });
});

// Função para executar o processo de flash
function executeFlashProcess(folderPath, resolve) {
  console.log('🚀 INICIANDO PROCESSO DE FLASH...');
  
  const tempBatPath = path.join(os.tmpdir(), `flash_unisoc_${Date.now()}.bat`);
  
  const batchContent = `@echo off
echo ======================================
echo Unisoc Flash Tools
echo Iniciando processo de flash
echo ======================================
echo.

cd /d "${folderPath}"

echo Executando spd_dump.exe...
"spd_dump.exe" --wait 300 ^
baudrate 115200 ^
exec_addr 0x3ee8 ^
fdl fdl1-moto-java.bin 0x5500 ^
fdl fdl2-moto-java.bin 0x9EFFFE00 ^
exec ^
verbose 0 ^
disable_transcode ^
keep_charge 1 ^
skip_confirm 1 ^
timeout 333666999 ^
erase_part splloader ^
erase_part uboot_log ^
write_part vbmeta_a vbmeta-sign.img ^
write_part vbmeta_b vbmeta-sign.img ^
write_part vbmeta_system_a vbmeta_system.img ^
write_part vbmeta_system_b vbmeta_system.img ^
write_part vbmeta_system_ext_a vbmeta_system_ext.img ^
write_part vbmeta_system_ext_b vbmeta_system_ext.img ^
write_part vbmeta_vendor_a vbmeta_vendor.img ^
write_part vbmeta_vendor_b vbmeta_vendor.img ^
write_part vbmeta_product_a vbmeta_product.img ^
write_part vbmeta_product_b vbmeta_product.img ^
write_part boot_a boot.img ^
write_part boot_b boot.img ^
write_part dtbo_a dtbo.img ^
write_part dtbo_b dtbo.img ^
write_part super super.img ^
write_part cache cache.img ^
erase_part userdata ^
erase_part metadata ^
write_part splloader u-boot-spl-16k-sign.bin ^
reset

echo.
echo ======================================
echo Processo de flash concluído!
echo ======================================
pause`;

  try {
    fs.writeFileSync(tempBatPath, batchContent, 'utf8');
    console.log(`✅ Batch criado: ${tempBatPath}`);
  } catch (error) {
    console.log(`❌ Erro ao criar batch: ${error.message}`);
    resolve({ success: false, output: `Erro ao criar arquivo batch: ${error.message}` });
    return;
  }

  const batProcess = spawn('cmd.exe', ['/c', tempBatPath], {
    cwd: folderPath,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  
  batProcess.stdout.on('data', (data) => {
    const dataStr = data.toString();
    output += dataStr;
    mainWindow.webContents.send('flash-output', dataStr);
  });
  
  batProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    output += dataStr;
    mainWindow.webContents.send('flash-output', dataStr);
  });
  
  batProcess.on('close', (code) => {
    console.log(`🔚 Processo finalizado - Código: ${code}`);
    
    try {
      fs.unlinkSync(tempBatPath);
      console.log('✅ Arquivo batch removido');
    } catch (e) {
      console.log('⚠️ Erro ao remover batch temporário');
    }
    
    const success = code === 0;
    console.log(`🎯 Flash ${success ? 'BEM-SUCEDIDO' : 'FALHOU'}`);
    
    resolve({ 
      success: success, 
      output: output,
      exitCode: code
    });
  });
  
  batProcess.on('error', (error) => {
    console.log(`💥 Erro no processo: ${error.message}`);
    
    try {
      fs.unlinkSync(tempBatPath);
    } catch (e) {}
    
    resolve({ 
      success: false, 
      output: `Erro ao executar processo: ${error.message}`
    });
  });
}

// Outros IPC handlers...
ipcMain.handle('connect-device', async () => {
  return { success: true, message: "Dispositivo conectado" };
});

ipcMain.handle('reboot-device', async () => {
  return { success: true, message: "Dispositivo reiniciado" };
});

ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('minimize-app', () => {
  mainWindow.minimize();
});

ipcMain.handle('maximize-app', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

console.log('🔧 Main process inicializado');