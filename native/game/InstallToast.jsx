// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useT} from '../i18n/index.js';
import {Toast} from '../ui/Toast.jsx';

export const TOAST_MS = 4500;

export function InstallToast({game, started}) {
  const t = useT();
  return (
    <Toast game={game} icon={started ? 'download' : 'circleCheck'} status={t(started ? 'install.added' : 'install.complete')}
      title={game.title} detail={t('install.manage')} duration={TOAST_MS} inPage />
  );
}
