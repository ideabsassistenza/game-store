// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {Text, View, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {SideSheet} from '../ui/SideSheet.jsx';
import {colors} from '../ui/colors.js';
import {preferredRelease} from './releases.js';
import {describeSource, isOverdriveCdn, sourceSections} from './sources.js';
import {CdnAura, CdnSpark} from '../ui/CdnAura.jsx';
import {VersionFace} from './VersionSheet.jsx';

// `title` and `note` are message keys.
const SECTION = {
  direct: {title: 'sources.section.direct', icon: 'download'},
  page: {title: 'sources.section.page', icon: 'download', note: 'sources.section.pageNote'},
  browser: {title: 'sources.section.browser', icon: 'external'},
  dlc: {title: 'sources.section.dlc', icon: 'download', note: 'sources.section.dlcNote'},
};

function RowFace({icon, name, detail, size, recommended, current, cdn}) {
  const t = useT();
  const focused = useIsFocused();
  const ink = focused ? colors.fg : colors.muted;
  return (
    <>
      {cdn ? <CdnAura radius={8} width={492} /> : null}
      <FocusRing />
      {cdn ? <CdnSpark size={18} /> : <Icon name={icon} size={18} color={ink} />}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-sans text-[15px] font-semibold text-fg">{name}</Text>
          {recommended ? (
            <View className="rounded-sm bg-fg px-1.5 py-px">
              <Text className="font-sans text-xs font-semibold text-canvas">{t('sources.recommended')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{color: ink}} className="w-[300px] font-sans text-sm line-clamp-2">{detail || t('sources.noDetails')}</Text>
      </View>
      <Text style={{color: ink}} className="w-[72px] font-sans text-sm text-end">{size ?? ''}</Text>
      <View className="w-[18px] items-end">
        {current ? <Icon name="check" size={18} color={colors.fg} /> : null}
      </View>
    </>
  );
}

// `revealed`: the section just unfolded, so its first row takes the focus its fold row had.
function Section({group, items, selected, recommended, revealed, onPick}) {
  const t = useT();
  const {title, icon, note} = SECTION[group];
  return (
    <View className="gap-1">
      <View className="mb-1 gap-0.5 px-3">
        <Text className="font-sans text-[13px] font-semibold text-subtle">{`${t(title)} · ${items.length}`}</Text>
        {note ? <Text className="w-[440px] font-sans text-sm text-subtle line-clamp-2">{t(note)}</Text> : null}
      </View>
      {items.map(({release, index}, row) => {
        const {name, detail, size} = describeSource(release);
        return (
          <View key={release.id} autoFocus={index === selected || (revealed && row === 0)} onPress={() => onPick(index)}
            className="relative min-h-14 flex-row items-center gap-3 rounded-lg px-3 py-2 focused:bg-surface-2">
            <RowFace icon={icon} name={name} detail={detail} size={size} cdn={isOverdriveCdn(release.provider)}
              recommended={index === recommended && group !== 'browser'} current={index === selected} />
          </View>
        );
      })}
    </View>
  );
}

function RevealFace({count}) {
  const t = useT();
  const focused = useIsFocused();
  const ink = focused ? colors.fg : colors.muted;
  return (
    <>
      <FocusRing />
      <Icon name="external" size={18} color={ink} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[15px] font-semibold text-fg">{t('sources.showBrowser', {count})}</Text>
        <Text style={{color: ink}} className="w-[380px] font-sans text-sm line-clamp-2">
          {t('sources.browserNote')}
        </Text>
      </View>
      <Icon name="chevronDown" size={18} color={ink} />
    </>
  );
}

// The title's other editions (PS4 and PS5, regions) lead the sheet, so a version can be chosen even
// while the download button can't start, as when this edition doesn't fit.
function Versions({editions, current, onEdition}) {
  const t = useT();
  return (
    <View className="gap-1">
      <Text className="mb-1 px-3 font-sans text-[13px] font-semibold text-subtle">{`${t('sources.section.versions')} · ${editions.length}`}</Text>
      {editions.map((edition, index) => (
        <View key={edition.id} onPress={() => onEdition(edition)}
          className="relative flex-row items-center gap-4 rounded-lg px-3 py-3 focused:bg-surface-2">
          <VersionFace edition={edition} here={edition.id === current} recommended={index === 0 && edition.platform === 'ps5'}
            twin={editions.some(other => other !== edition && other.platform === edition.platform)} />
        </View>
      ))}
    </View>
  );
}

/**
 * The game's sources in a sheet beside the page: the ones that download inside the app first with the
 * recommended one marked. Hosts that need a web browser stay folded behind one row while an in-app
 * source exists: every part of theirs costs a page visit and a typed link. Add-on uploads come last, in
 * their own section. Incomplete sets are left out: none of them can be picked. With several `editions`,
 * a Version section comes first; picking another opens its page (`onEdition(id)`).
 */
export function SourcePicker({title, releases, selected, submit, editions = [], current, onEdition, onClose}) {
  const recommended = preferredRelease(releases);
  const sections = sourceSections(releases);
  const count = group => sections.find(section => section.group === group)?.items.length ?? 0;
  const [browser, setBrowser] = useState(() => !count('direct') && !count('page')
    || describeSource(releases[selected]).group === 'browser');
  const [revealed, setRevealed] = useState(false);
  const pick = index => { submit(index); onClose(); };
  const t = useT();
  return (
    <SideSheet title={t('sources.title')} subtitle={title} onClose={onClose}>
      <View className="gap-7 p-1.5 pb-8">
        {editions.length > 1 ? (
          <Versions editions={editions} current={current}
            onEdition={edition => { onClose(); if (edition.id !== current) onEdition(edition.id); }} />
        ) : null}
        {sections.filter(({group}) => group === 'direct' || group === 'page' || (browser && group === 'browser')).map(({group, items}) => (
          <Section key={group} group={group} items={items} selected={selected} recommended={recommended}
            revealed={revealed && group === 'browser'} onPick={pick} />
        ))}
        {!browser && count('browser') ? (
          <View onPress={() => { setBrowser(true); setRevealed(true); }}
            className="relative flex-row items-center gap-3 rounded-lg px-3 py-3 focused:bg-surface-2">
            <RevealFace count={count('browser')} />
          </View>
        ) : null}
        {count('dlc') ? <Section group="dlc" items={sections.find(({group}) => group === 'dlc').items} selected={selected}
          recommended={-1} revealed={false} onPick={pick} /> : null}
      </View>
    </SideSheet>
  );
}
