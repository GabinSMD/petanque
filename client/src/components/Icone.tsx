import { Medal, type LucideIcon, type LucideProps } from 'lucide-react';

/**
 * Pictogramme porté par une donnée (formule de concours, entrée du journal,
 * prochaine étape) : la donnée désigne le dessin, ce composant le pose à la
 * taille du texte qui l'entoure.
 */
export function Icone({ de: Dessin, className, ...props }: { de: LucideIcon } & LucideProps) {
  return <Dessin className={className ? `ic ${className}` : 'ic'} aria-hidden {...props} />;
}

/**
 * Rang dans un classement : une médaille teintée pour le podium, toujours
 * accompagnée du chiffre — la couleur seule ne dit rien à qui ne la voit pas.
 */
export function Rang({ index }: { index: number }) {
  if (index > 2) return <>{index + 1}</>;
  return (
    <span className={`rang-podium rang-podium-${index + 1}`}>
      <Medal className="ic" aria-hidden />
      {index + 1}
    </span>
  );
}
