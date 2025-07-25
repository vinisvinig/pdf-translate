document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o worker do PDF.js
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

  // Elementos do DOM
  const input       = document.getElementById('pdfInput');
  const fileName    = document.getElementById('fileName');
  const progressBar = document.getElementById('loadProgress');
  const btn         = document.getElementById('translateBtn');
  const status      = document.getElementById('status');
  const output      = document.getElementById('output');

  let fileBuffer = null;

  // Upload e barra de progresso
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    progressBar.style.display = 'inline-block';
    progressBar.value = 0;
    status.textContent = 'Carregando PDF... 0%';
    btn.disabled = true;
    output.style.display = 'none';

    const reader = new FileReader();
    reader.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.value = pct;
        status.textContent = `Carregando PDF... ${pct}%`;
      }
    };
    reader.onload = () => {
      fileBuffer = reader.result;
      progressBar.style.display = 'none';
      status.textContent = 'Carregado!';
      btn.disabled = false;
    };
    reader.onerror = () => {
      progressBar.style.display = 'none';
      status.textContent = 'Erro ao carregar PDF.';
    };
    reader.readAsArrayBuffer(file);
  });

  // Extração, tradução e geração do novo PDF
  btn.addEventListener('click', async () => {
    if (!fileBuffer) return;

    btn.disabled = true;
    status.textContent = 'Lendo texto do PDF…';

    try {
      // Extrai texto
      const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Garante que o texto seja extraído de forma mais robusta e com espaços
        fullText     += content.items.map(item => item.str).join(' ') + '\n\n';
      }

      // Tradução via proxy + LibreTranslate
      status.textContent = 'Traduzindo conteúdo…';
      // Novo proxy CORS: api.allorigins.win
      const proxyUrl = 'https://api.allorigins.win/raw?url=' +
        encodeURIComponent('https://libretranslate.de/translate');

      const translated = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q:      fullText,
          source: 'auto',
          target: 'pt',
          format: 'text'
        })
      })
      .then(res => {
        if (!res.ok) {
            console.error('Erro na resposta do servidor de tradução:', res.status, res.statusText);
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(json => json.translatedText)
      .catch(err => {
        console.error('Erro na tradução:', err);
        status.textContent = 'Falha na tradução. Verifique o console para mais detalhes.';
        return fullText; // fallback para o texto original
      });

      // Exibe texto traduzido
      output.textContent = translated;
      output.style.display = 'block';
      status.textContent   = 'Gerando novo PDF…';

      // Gera PDF traduzido
      const { PDFDocument, StandardFonts } = PDFLib;
      const doc = await PDFDocument.create();

      // **IMPORTANTE:** Carregue uma fonte com suporte a Unicode
      // Você precisará ter um arquivo .ttf (por exemplo, 'arial.ttf') no seu projeto ou acessível via URL.
      // Substitua 'caminho/para/sua/fonte/arial.ttf' pelo caminho real do seu arquivo.
      // Se você não tiver um arquivo de fonte, pode tentar usar uma URL de CDN para fontes comuns como Roboto.
      // Exemplo com fonte local:
      const fontPath = 'fonts/Roboto-Regular.ttf'; // <--- Mude este caminho para o seu arquivo .ttf!
      let font;

      try {
          const fontBytes = await fetch(fontPath)
                                  .then(res => {
                                      if (!res.ok) throw new Error(`Não foi possível carregar a fonte: ${res.statusText}`);
                                      return res.arrayBuffer();
                                  });
          font = await doc.embedFont(fontBytes);
          console.log('Fonte personalizada carregada com sucesso.');
      } catch (err) {
          console.error(`Erro ao carregar a fonte personalizada em '${fontPath}'. Usando StandardFonts.Helvetica como fallback.`, err);
          font = await doc.embedFont(StandardFonts.Helvetica);
          // Se fallback para Helvetica, limpe caracteres problemáticos
          translated = translated.replace(/[\u2032\u2033]/g, "'"); // Substitui 'prime' e 'double prime' por apóstrofos simples
      }

      const size = 12, margin = 50;
      let page = doc.addPage(), y = page.getHeight() - margin;

      // Passa o texto (potencialmente limpo se fallback de fonte) para a função de quebra de linhas
      for (let line of splitIntoLines(translated, 80)) {
        if (y < margin) {
          page = doc.addPage();
          y    = page.getHeight() - margin;
        }
        page.drawText(line, { x: margin, y, size, font });
        y -= size + 4;
      }

      const pdfBytes = await doc.save();
      const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
      const a        = document.createElement('a');
      a.href         = URL.createObjectURL(blob);
      a.download     = 'pdf_traduzido.pdf';
      a.click();

      status.textContent = 'PDF traduzido baixado com sucesso!';
      btn.disabled       = false;

    } catch (error) {
      console.error('Um erro inesperado ocorreu:', error);
      status.textContent = 'Ocorreu um erro durante o processo. Verifique o console.';
      btn.disabled = false;
    }
  });

  // Quebra texto em linhas
  function splitIntoLines(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let line    = '';
    for (const w of words) {
      // Se a palavra sozinha já for maior que maxChars, trate-a (quebre-a)
      if (w.length > maxChars) {
        if (line.trim().length > 0) { // Adiciona a linha atual antes de quebrar a palavra longa
          lines.push(line.trim());
          line = '';
        }
        // Quebra a palavra longa em pedaços
        for (let i = 0; i < w.length; i += maxChars) {
          lines.push(w.substring(i, Math.min(i + maxChars, w.length)));
        }
        continue; // Pula para a próxima palavra
      }

      // Se adicionar a palavra atual exceder o limite, inicia uma nova linha
      if ((line + w).length > maxChars && line.length > 0) { // line.length > 0 evita uma linha vazia no início
        lines.push(line.trim());
        line = '';
      }
      line += w + ' ';
    }
    // Adiciona a última linha se não estiver vazia
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
});
