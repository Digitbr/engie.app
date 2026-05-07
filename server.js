const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const moment = require('moment');
const path = require('path');

const app = express();

// Middlewares (Limite aumentado para suportar o Base64 das fotos)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para calcular horário de saída (+30 minutos)
function calcularSaida(chegada) {
    if (!chegada || chegada === '0' || chegada.toLowerCase() === 'nenhuma') return '';
    try {
        return moment(chegada, 'HH:mm').add(30, 'minutes').format('HH:mm');
    } catch {
        return '';
    }
}

// Função auxiliar para calcular tempo de permanência
function calcularPermanencia(chegada, saida) {
    if (!chegada || !saida || chegada === '0' || saida === '0') return '00:00:00';
    try {
        const format = 'HH:mm';
        const start = moment(chegada, format);
        const end = moment(saida, format);
        const diff = moment.duration(end.diff(start));
        const hours = Math.floor(diff.asHours()).toString().padStart(2, '0');
        const minutes = diff.minutes().toString().padStart(2, '0');
        return `${hours}:${minutes}:00`;
    } catch {
        return '00:00:00';
    }
}

app.post('/api/gerar-relatorio', async (req, res) => {
    try {
        const data = req.body;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Relatório Diário');

        // Configuração visual das colunas para simular o CSV fornecido
        sheet.columns = [
            { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }, 
            { width: 15 }, { width: 20 }, { width: 15 }, { width: 20 }, { width: 15 }
        ];

        // --- Cabeçalho ---
        sheet.mergeCells('A1:I1');
        sheet.getCell('A1').value = `RELATÓRIO DIÁRIO DE RONDAS - ${data.unidade.toUpperCase()}`;
        sheet.getCell('A1').font = { bold: true, size: 14 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A3:I3');
        sheet.getCell('A3').value = `DATA: ${data.dataTurno}`;
        sheet.getCell('A3').font = { bold: true };

        sheet.getCell('A4').value = 'CLIENTE';
        sheet.getCell('F4').value = 'Nº do Contrato';
        sheet.getCell('H4').value = 'CONTRATADA';
        sheet.getRow(4).font = { bold: true };

        sheet.mergeCells('A5:E5');
        sheet.getCell('A5').value = 'ESOM – Engie Soluções de Operação e Manutenção';
        sheet.getCell('F5').value = 'AC380ESOM';
        sheet.mergeCells('H5:I5');
        sheet.getCell('H5').value = 'V F S SISTEMA ELETRÔNICO DE ALARME LTDA';

        // --- Ocorrências ---
        sheet.mergeCells('A7:I7');
        sheet.getCell('A7').value = '1. DESCRIÇÃO (ÕES) DA(S) OCORRÊNCIA(S):';
        sheet.getCell('A7').font = { bold: true };

        sheet.mergeCells('A8:I12');
        const descText = `1ª Ronda:\n${data.ronda1Desc}\n\n2ª Ronda:\n${data.ronda2Desc}`;
        const descCell = sheet.getCell('A8');
        descCell.value = descText;
        descCell.alignment = { wrapText: true, vertical: 'top' };

        // --- Paralisações ---
        sheet.mergeCells('A14:I14');
        sheet.getCell('A14').value = '2- PARALISAÇÕES (DURAÇÃO E MOTIVO)';
        sheet.getCell('A14').font = { bold: true };
        sheet.mergeCells('A15:I15');
        sheet.getCell('A15').value = data.paralisacoes || 'Nenhuma';

        // --- Fotos ---
        sheet.mergeCells('A17:I17');
        sheet.getCell('A17').value = '3- REGISTRO FOTOGRÁFICO';
        sheet.getCell('A17').font = { bold: true };

        sheet.getCell('A18').value = 'Imagem 01 -';
        sheet.getCell('F18').value = 'Imagem 02 -';
        sheet.getCell('A27').value = 'Imagem 03 -';
        sheet.getCell('F27').value = 'Imagem 04 -';

        if (data.fotos && data.fotos.length > 0) {
            const posicoes = [
                { tl: { col: 0, row: 18 }, br: { col: 4, row: 25 } }, // Img 1
                { tl: { col: 5, row: 18 }, br: { col: 8, row: 25 } }, // Img 2
                { tl: { col: 0, row: 27 }, br: { col: 4, row: 34 } }, // Img 3
                { tl: { col: 5, row: 27 }, br: { col: 8, row: 34 } }  // Img 4
            ];

            data.fotos.slice(0, 4).forEach((fotoBase64, index) => {
                const imageId = workbook.addImage({
                    base64: fotoBase64,
                    extension: 'jpeg',
                });
                sheet.addImage(imageId, posicoes[index]);
            });
        }

        // --- Horários de Ronda ---
        const startRow = 36;
        sheet.getCell(`A${startRow}`).value = 'CHEGADA NA UNIDADE';
        sheet.getCell(`C${startRow}`).value = 'TEMPO DE PERMANÊNCIA';
        sheet.getCell(`E${startRow}`).value = 'SAÍDA DA UNIDADE';
        sheet.getCell(`G${startRow}`).value = 'CHEGADA NA UNIDADE (2)';
        sheet.getCell(`I${startRow}`).value = 'SAÍDA DA UNIDADE (2)';
        sheet.getRow(startRow).font = { bold: true };

        const chegada1 = data.ronda1Horarios.trim() || '';
        const saida1 = calcularSaida(chegada1);
        const chegada2 = data.ronda2Horarios.trim() || '';
        const saida2 = calcularSaida(chegada2);

        sheet.getCell(`A${startRow+1}`).value = chegada1 ? `${chegada1}:00` : '';
        sheet.getCell(`C${startRow+1}`).value = calcularPermanencia(chegada1, saida1);
        sheet.getCell(`E${startRow+1}`).value = saida1 ? `${saida1}:00` : '';
        sheet.getCell(`G${startRow+1}`).value = chegada2 ? `${chegada2}:00` : '';
        sheet.getCell(`I${startRow+1}`).value = saida2 ? `${saida2}:00` : '';

        // Estilização básica (Bordas)
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: {style:'thin'}, left: {style:'thin'}, 
                    bottom: {style:'thin'}, right: {style:'thin'}
                };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Relatorio_${data.unidade}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar o relatório.' });
    }
});

// Exporta o app para o Vercel Serverless
module.exports = app;

// Mantém o listen apenas para rodar localmente no seu PC
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor local rodando na porta ${PORT}`);
    });
});
