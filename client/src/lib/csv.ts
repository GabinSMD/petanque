/**
 * L'analyse du fichier des licenciés vit dans `shared/` : elle est pure,
 * testée, et le moteur de contrôle des licences s'appuie sur les mêmes
 * champs. Ce module ne reste que pour ne pas disperser les imports du client.
 */
export { parseLicenciesCsv, parseDateFr, type LicencieRow } from '@shared';
