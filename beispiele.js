/* Beispielprojekte = Testfälle A–C aus dem Auftrag */
(function (root) {
  'use strict';
  function z(punkt, zwR, zwV, R, Z, V, bem) { return { punkt: punkt, zwR: zwR || '', zwV: zwV || '', R: R || '', Z: Z || '', V: V || '', bem: bem || '' }; }
  function kopf(projekt) { return { projekt: projekt, instrument: '', datum: '', wetter: '', feldbuchfuehrer: '', beobachter: '', bearbeiter: '', blatt: '1' }; }

  var BEISPIELE = {
    A: {
      titel: 'Testfall A – Übung 1 (LfVT-Feldbuch, ohne Endhöhe)',
      projekt: {
        kopf: kopf('Testfall A – Übung 1 (LfVT-Feldbuch)'), HA: '74,251', HEsoll: '', schleife: false, einst: {},
        zeilen: [
          z('A', '', '', '2,431', '', '', 'Anschlusspunkt (Höhenfestpunkt)'),
          z('WP1', '', '', '0,338', '', '2,371', 'Wechselpunkt'),
          z('2', '', '', '1,934', '', '1,830', 'Wechselpunkt'),
          z('3', '', '', '0,892', '', '2,809', 'Wechselpunkt'),
          z('4', '', '', '3,085', '', '0,746', 'Wechselpunkt'),
          z('5', '', '', '1,435', '', '1,184', 'Wechselpunkt'),
          z('6', '', '', '1,364', '', '0,848', 'Wechselpunkt'),
          z('7', '', '', '0,654', '', '3,011', 'Wechselpunkt'),
          z('8', '', '', '0,718', '', '1,461', 'Wechselpunkt'),
          z('9', '', '', '0,693', '', '0,987', 'Wechselpunkt'),
          z('10', '', '', '2,500', '', '3,119', 'Wechselpunkt'),
          z('E', '', '', '', '', '2,724', 'Endpunkt')
        ]
      }
    },
    B: {
      titel: 'Testfall B – Lehrbuchbeispiel mit Zwischenpunkt (Zielweiten angenommen)',
      projekt: {
        kopf: kopf('Testfall B – Lehrbuch Kap. 2.5 (Zielweiten angenommen)'), HA: '431,350', HEsoll: '435,135', schleife: false, einst: {},
        zeilen: [
          z('1', '30', '', '3,926', '', '', 'Mauerbolzen'),
          z('W1', '20', '30', '2,135', '', '1,846', 'Wechselpunkt'),
          z('Z', '', '12', '', '1,350', '', 'Zwischenpunkt'),
          z('W2', '15', '20', '2,571', '', '1,207', 'Wechselpunkt'),
          z('2', '', '15', '', '', '1,798', 'Pfeilerbolzen')
        ]
      }
    },
    C: {
      titel: 'Testfall C – Infoblatt HSBK (Δh-Bildung, Zwischenblicke)',
      projekt: {
        kopf: kopf('Testfall C – Infoblatt HSBK'), HA: '150,000', HEsoll: '', schleife: false, einst: {},
        zeilen: [
          z('500', '', '', '1,770', '', '', 'Anschlusspunkt (Höhenfestpunkt)'),
          z('WP1', '', '', '1,375', '', '1,410', 'Wechselpunkt'),
          z('100', '', '', '1,415', '', '1,270', 'Wechselpunkt'),
          z('1', '', '', '', '1,495', '', 'Zwischenpunkt'),
          z('2', '', '', '', '1,580', '', 'Zwischenpunkt'),
          z('3', '', '', '', '1,595', '', 'Zwischenpunkt')
        ]
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BEISPIELE;
  else root.NivBeispiele = BEISPIELE;
})(this);
