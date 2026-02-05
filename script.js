// Elementos do DOM
const selectFilesBtn = document.getElementById('selectFilesBtn');
const flashBtn = document.getElementById('flashBtn');
const statusArea = document.getElementById('statusArea');
const fileListContainer = document.getElementById('fileListContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const deviceItems = document.querySelectorAll('.device-item');
const selectedDeviceSpan = document.getElementById('selectedDevice');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const checkFilesBtn = document.getElementById('checkFilesBtn');
const responseText = document.getElementById('responseText');
const folderPath = document.getElementById('folderPath');
const closeBtn = document.getElementById('closeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const deviceSearch = document.querySelector('.device-search');
const notification = document.getElementById('notification');

// Lista de arquivos essenciais (SEM os arquivos FDL e spd_dump - serão copiados automaticamente)
const essentialFiles = [
    "vbmeta-sign.img",
    "vbmeta_system.img",
    "vbmeta_system_ext.img",
    "vbmeta_vendor.img",
    "vbmeta_product.img",
    "boot.img",
    "dtbo.img",
    "super.img",
    "cache.img",
    "u-boot-spl-16k-sign.bin"
];

// Variáveis de estado
let firmwarePath = "";
let firmwareFiles = [];
let selectedDevice = "Unisoc T700";
let isFlashing = false;

// Função para mostrar notificação
function showNotification(message, type = 'info') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Função para adicionar logs
function addLog(msg, type = 'info') {
    const lines = msg.split('\n');
    lines.forEach(line => {
        if (line.trim() === '') return;
        
        const div = document.createElement('div');
        div.classList.add(`log-${type}`);
        
        // Adicionar timestamp
        const now = new Date();
        const timestamp = `[${now.toLocaleTimeString()}]`;
        
        div.textContent = `${timestamp} ${line}`;
        statusArea.appendChild(div);
    });
    statusArea.scrollTop = statusArea.scrollHeight;
}

// Inicializar lista de arquivos
function initializeFileList() {
    fileListContainer.innerHTML = '';
    essentialFiles.forEach(fileName => {
        const div = document.createElement('div');
        div.classList.add('file-item', 'missing');
        div.textContent = fileName;
        div.dataset.file = fileName;
        fileListContainer.appendChild(div);
    });
}

// Atualizar status dos arquivos
function updateFileStatus() {
    const fileItems = fileListContainer.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const fileName = item.dataset.file;
        if (firmwareFiles.includes(fileName)) {
            item.classList.remove('missing');
            item.classList.add('present');
        } else {
            item.classList.remove('present');
            item.classList.add('missing');
        }
    });
}

// Atualizar progresso
function updateProgress(percent, text = null) {
    percent = Math.max(0, Math.min(100, percent));
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    if (text) responseText.textContent = text;
}

// Filtrar dispositivos
function filterDevices() {
    const searchTerm = deviceSearch.value.toLowerCase();
    deviceItems.forEach(item => {
        const deviceName = item.dataset.device.toLowerCase();
        if (deviceName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Inicialização
addLog('Sistema inicializado. Aguardando comando...');
addLog('💡 Os arquivos FDL e spd_dump serão copiados automaticamente durante o flash');
initializeFileList();

// Controles da janela
closeBtn.addEventListener('click', () => {
    window.electronAPI.closeApp();
});

minimizeBtn.addEventListener('click', () => {
    window.electronAPI.minimizeApp();
});

maximizeBtn.addEventListener('click', () => {
    window.electronAPI.maximizeApp();
});

// Pesquisa de dispositivos
deviceSearch.addEventListener('input', filterDevices);

// Seleção de dispositivo
deviceItems.forEach(item => {
    item.addEventListener('click', () => {
        deviceItems.forEach(d => d.classList.remove('selected'));
        item.classList.add('selected');
        selectedDevice = item.dataset.device;
        selectedDeviceSpan.textContent = selectedDevice;
        addLog(`Dispositivo '${selectedDevice}' selecionado.`, 'info');
    });
});

// Seleção da pasta de firmware
selectFilesBtn.addEventListener('click', async () => {
    if (isFlashing) {
        showNotification('Aguarde o flash terminar', 'warning');
        return;
    }
    
    addLog('Abrindo seletor de pasta...', 'info');
    
    try {
        const result = await window.electronAPI.selectFirmwareFolder();
        if (result.canceled) {
            addLog('Seleção de pasta cancelada', 'warning');
            return;
        }
        
        firmwarePath = result.path;
        firmwareFiles = result.files || [];
        
        folderPath.textContent = firmwarePath;
        folderPath.title = firmwarePath;
        
        addLog(`Pasta selecionada: ${firmwarePath}`, 'success');
        addLog(`${firmwareFiles.length} arquivos encontrados`, 'info');
        updateFileStatus();

        // Verificar arquivos essenciais
        const missingFiles = essentialFiles.filter(file => !firmwareFiles.includes(file));
        if (missingFiles.length === 0) {
            addLog('✅ Todos os arquivos essenciais estão presentes!', 'success');
            flashBtn.disabled = false;
            showNotification('Firmware verificado com sucesso', 'success');
        } else {
            addLog(`Faltam ${missingFiles.length} arquivo(s):`, 'warning');
            missingFiles.forEach(file => addLog(`${file}`, 'error'));
            flashBtn.disabled = true;
            showNotification(`Faltam ${missingFiles.length} arquivos`, 'error');
        }
    } catch (error) {
        addLog(`Erro ao selecionar pasta: ${error.message}`, 'error');
        showNotification('Erro ao selecionar pasta', 'error');
    }
});

// Verificação de arquivos
checkFilesBtn.addEventListener('click', () => {
    if (!firmwarePath) {
        addLog('Nenhuma pasta selecionada', 'error');
        showNotification('Selecione uma pasta primeiro', 'error');
        return;
    }
    
    addLog('Verificando arquivos...', 'info');
    const missingFiles = essentialFiles.filter(file => !firmwareFiles.includes(file));
    
    if (missingFiles.length === 0) {
        addLog('✅ Todos os arquivos essenciais estão presentes!', 'success');
        addLog('💡 Arquivos FDL e spd_dump serão copiados automaticamente', 'info');
        responseText.textContent = 'Firmware completo';
        flashBtn.disabled = false;
        showNotification('Firmware verificado com sucesso', 'success');
    } else {
        addLog(`Faltam ${missingFiles.length} arquivo(s) essencial(is)`, 'error');
        missingFiles.forEach(file => addLog(`${file}`, 'error'));
        responseText.textContent = `Faltam ${missingFiles.length} arquivos`;
        flashBtn.disabled = true;
        showNotification(`Faltam ${missingFiles.length} arquivos`, 'error');
    }
});

// FLASH - Execução real
flashBtn.addEventListener('click', async () => {
    if (!firmwarePath) {
        addLog('Selecione a pasta do firmware primeiro', 'error');
        showNotification('Selecione uma pasta primeiro', 'error');
        return;
    }
    
    if (isFlashing) {
        showNotification('Flash já em andamento', 'warning');
        return;
    }
    
    addLog('INICIANDO PROCESSO DE FLASH...', 'info');
    addLog('📁 Copiando arquivos spd_dump e FDL para a pasta do firmware...', 'info');
    
    isFlashing = true;
    flashBtn.disabled = true;
    updateProgress(10, 'Copiando arquivos...');
    showNotification('Iniciando processo de flash', 'info');

    // Configurar listener para logs em tempo real
    window.electronAPI.onFlashOutput((event, output) => {
        addLog(output, 'cmd');
        
        // Atualizar progresso baseado na saída
        if (output.includes('Iniciando flash')) {
            updateProgress(30, 'Iniciando flash...');
        } else if (output.includes('write_part') || output.includes('erase_part')) {
            updateProgress(60, 'Gravando partições...');
        } else if (output.includes('Processo concluído')) {
            updateProgress(90, 'Finalizando...');
        }
    });

    try {
        const result = await window.electronAPI.runFirmwareFlashCMD(firmwarePath);
        
        if (result.success) {
            updateProgress(100, 'Flash concluído!');
            addLog('🎉 FLASH CONCLUÍDO COM SUCESSO!', 'success');
            showNotification('Flash concluído com sucesso!', 'success');
        } else {
            updateProgress(0, 'Falha no flash');
            addLog('💥 FLASH FALHOU!', 'error');
            if (result.output) {
                const errorLines = result.output.split(/\r?\n/).filter(line => line.trim());
                errorLines.forEach(line => {
                    if (line.toLowerCase().includes('error')) {
                        addLog(line, 'error');
                    } else {
                        addLog(line, 'cmd');
                    }
                });
            }
            showNotification('Falha durante o flash', 'error');
        }
    } catch (error) {
        updateProgress(0, 'Erro no flash');
        addLog(`💥 ERRO: ${error.message}`, 'error');
        showNotification('Erro durante o flash', 'error');
    } finally {
        isFlashing = false;
        flashBtn.disabled = false;
        window.electronAPI.removeFlashOutputListeners();
    }
});

// Limpar logs
clearLogsBtn.addEventListener('click', () => {
    statusArea.innerHTML = '';
    addLog('Logs limpos. Sistema pronto.', 'info');
    responseText.textContent = 'Pronto';
    showNotification('Logs limpos', 'info');
});