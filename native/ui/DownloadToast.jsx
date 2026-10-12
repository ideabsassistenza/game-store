// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {AnimatePresence} from '@ps5-react/core';
import {useDownloadAlerts} from '../downloads/useDownloadAlerts.js';
import {useT} from '../i18n/index.js';
import {getGame} from '../state/catalog.js';
import {useNavActions, useNavState} from '../state/nav.jsx';
import {Toast} from './Toast.jsx';
import {pulseNotice} from './haptics.js';

const TOAST_MS = 6000;

/**
 * The corner notice for a download that finishes or fails while any screen is up, like the
 * console's own (its system notification does not reach every firmware). It leaves on its own;
 * while it shows, R2 opens the game or, after a failure, Downloads (the header's scope asks
 * `actionRef`): R2 has no other owner, unlike Triangle. The Downloads screen and the game's own
 * page already show the change, so it stays quiet there.
 */
export function DownloadToast({actionRef}) {
  const t = useT();
  const [alert, setAlert] = useState(null);
  useDownloadAlerts(next => {
    pulseNotice();
    setAlert(last => ({...next, n: (last?.n ?? 0) + 1}));
  });
  const {top} = useNavState();
  const nav = useNavActions();
  const quiet = top.name === 'downloads' || (top.name === 'game' && top.id === alert?.gameId);
  const shown = alert && !quiet ? alert : null;
  const game = shown && getGame(shown.gameId);
  const failed = shown?.kind === 'failed';

  useEffect(() => {
    if (!alert) return undefined;
    const id = setTimeout(() => setAlert(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [alert]);
  actionRef.current = shown && (() => {
    setAlert(null);
    if (failed || !game) nav.push({name: 'downloads'});
    else nav.openGame(game.id);
  });

  return (
    <AnimatePresence>
      {shown && (
        <Toast key={shown.n} game={game} icon={failed ? 'alert' : 'circleCheck'} status={shown.message}
          title={shown.title} failed={failed} action={{button: 'r2', label: t(failed ? 'toast.openDownloads' : 'toast.viewGame')}}
          duration={TOAST_MS} />
      )}
    </AnimatePresence>
  );
}
