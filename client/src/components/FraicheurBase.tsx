import { useFraicheurLicencies } from '../db/hooks';

/**
 * Date du fichier des licenciés, et l'alerte quand il est d'une saison révolue —
 * le « Fond ORANGE » du manuel §2.1 (p.8).
 *
 * Le composant lit lui-même la fraîcheur : il s'affiche à trois endroits — page
 * des licenciés, dépôt, contrôle avant tirage — et lui passer la donnée en
 * cascade obligerait à la plomber dans trois arbres pour un renseignement de
 * deux lignes. Le hook ne charge pas le fichier, seulement son compte et sa date.
 *
 * `compact` sert dans une fenêtre déjà chargée : on n'y montre la date que
 * lorsqu'elle pose un problème.
 */
export function FraicheurBase({ compact = false }: { compact?: boolean }) {
  const f = useFraicheurLicencies();
  if (f.nombre === 0) return null;
  if (compact && !f.perimee) return null;

  const date = f.date ? new Date(f.date).toLocaleDateString('fr-FR') : null;
  return (
    <p className={f.perimee ? 'base-licencies base-licencies-perimee' : 'base-licencies'}>
      {f.perimee ? '⚠ ' : ''}
      {date ? (
        <>
          Fichier des licenciés du <strong>{date}</strong>
        </>
      ) : (
        <>Fichier des licenciés sans date</>
      )}{' '}
      · {f.nombre} fiche{f.nombre > 1 ? 's' : ''}
      {f.perimee && (
        <>
          {' '}
          — <strong>saison {f.saison}</strong>, nous sommes en {f.saisonCourante}. Réimportez-le :
          les années de reprise et les certificats médicaux de cette base sont périmés, et les
          licences prises depuis en sont absentes.
        </>
      )}
    </p>
  );
}
