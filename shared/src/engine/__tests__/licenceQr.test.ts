import { describe, expect, it } from 'vitest';
import { parseLicenceQr } from '../licenceQr';

describe('décodage du contenu d un QR code de licence', () => {
  it('un numéro seul', () => {
    expect(parseLicenceQr('02635624')).toEqual({ licence: '02635624', brut: '02635624' });
  });

  it('tolère les espaces autour', () => {
    expect(parseLicenceQr('  02635624 \n')?.licence).toBe('02635624');
  });

  it('numéro ponctué de points ou d espaces', () => {
    expect(parseLicenceQr('011.023.0061')?.licence).toBe('0110230061');
    expect(parseLicenceQr('026 356 24')?.licence).toBe('02635624');
  });

  it('champs séparés : numéro puis nom et prénom', () => {
    const r = parseLicenceQr('02635624;DURAND;BLANDINE');
    expect(r).toMatchObject({ licence: '02635624', nom: 'DURAND', prenom: 'BLANDINE' });
    expect(r?.name).toBe('BLANDINE DURAND');
  });

  it('champs séparés dans un autre ordre', () => {
    const r = parseLicenceQr('DURAND|BLANDINE|02635624');
    expect(r).toMatchObject({ licence: '02635624', nom: 'DURAND', prenom: 'BLANDINE' });
  });

  it('préfixe explicite', () => {
    expect(parseLicenceQr('LIC:02635624')?.licence).toBe('02635624');
    expect(parseLicenceQr('licence=02635624')?.licence).toBe('02635624');
  });

  it('contenu JSON', () => {
    const r = parseLicenceQr('{"licence":"02635624","nom":"DURAND","prenom":"Blandine"}');
    expect(r).toMatchObject({ licence: '02635624', nom: 'DURAND', prenom: 'Blandine' });
  });

  it('adresse web portant le numéro', () => {
    expect(parseLicenceQr('https://ffpjp.fr/licence/02635624')?.licence).toBe('02635624');
    expect(parseLicenceQr('https://exemple.fr/l?licence=02635624&x=1')?.licence).toBe('02635624');
  });

  it('contenu inconnu : on rend le brut sans inventer de licence', () => {
    const r = parseLicenceQr('BONJOUR LE MONDE');
    expect(r?.licence).toBeUndefined();
    expect(r?.brut).toBe('BONJOUR LE MONDE');
  });

  it('un numéro trop court n est pas une licence', () => {
    expect(parseLicenceQr('1234')?.licence).toBeUndefined();
  });

  it('contenu vide : rien du tout', () => {
    expect(parseLicenceQr('')).toBeNull();
    expect(parseLicenceQr('   ')).toBeNull();
  });

  it('ne prend pas un numéro de club pour une licence quand la licence est étiquetée', () => {
    const r = parseLicenceQr('club=0266013;licence=02635624');
    expect(r?.licence).toBe('02635624');
  });
});
