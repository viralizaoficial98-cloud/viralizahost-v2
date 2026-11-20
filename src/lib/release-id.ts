// Identificação da release. O `git archive` (usado para criar /var/www/viralizahost-release-*)
// substitui os marcadores abaixo pelo commit e data (atributo export-subst em .gitattributes).
// Numa cópia Git normal ficam por substituir e a versão é lida do ficheiro RELEASE_COMMIT, se existir.
export const ARCHIVE_COMMIT = '$Format:%H$'
export const ARCHIVE_DATE = '$Format:%cI$'
