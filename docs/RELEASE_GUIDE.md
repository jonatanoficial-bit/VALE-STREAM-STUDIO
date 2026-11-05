# Guia de release

1. Execute typecheck, lint, testes e build.
2. Em Windows real, preencha a matriz de aceite com evidências sanitizadas.
3. Atualize versão e changelog, sem dados pessoais ou chaves.
4. Execute `pnpm dist` em Windows para NSIS e portátil.
5. Calcule SHA-256, crie release/tag e anexe apenas instaladores validados.
6. Avise sobre SmartScreen quando o binário não tiver assinatura. Assinatura de código é opcional e pode ter custo.
