# Decisões técnicas

1. **OBS como motor de mídia na Parte 1.** Reduz risco ao usar captura, mixer, encoder e RTMP maduros, sem embutir binários GPL no executável VALE.
2. **VDO.Ninja como conferência externa.** Evita prometer infraestrutura própria zero-custo; o limite do provedor é explicitado.
3. **PDF.js + LibreOffice local.** Mantém documentos no computador e evita conversão SaaS.
4. **Um destino de live por vez.** OBS padrão suporta uma saída; multistream será feito somente com solução local testada.
5. **Credenciais no `safeStorage`.** Proíbe persistência deliberada de chave em texto plano.
