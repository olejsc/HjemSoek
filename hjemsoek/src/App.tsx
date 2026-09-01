import React from 'react';
import type { Group, ModuleWeights, CapacitySubweight, WorkSubweight, ConnectionSubweight, HealthcareSubweight, EducationSubweight, CapacityOptions } from './types';
import GroupEditor from './components/GroupEditor';
import WeightEditor from './components/WeightEditor';
import MunicipalityScoreTable from './components/MunicipalityScoreTable';
import { createNorwayMunicipalities, regions, professions } from './mockdata';

type PageId = 'legacy' | 'radial' | 'rts' | 'packet-builder';

const pages: { id: PageId; label: string; href: string }[] = [
  { id: 'legacy', label: 'Legacy', href: '#/legacy' },
  { id: 'radial', label: 'Radial menu concept', href: '#/radial-menu-concept' },
  { id: 'rts', label: 'RTS', href: '#/rts' },
  {
    id: 'packet-builder',
    label: 'Packet builder and simulator',
    href: '#/packet-builder-and-simulator',
  },
];

function getPageFromHash(): PageId {
  if (window.location.hash === '#/radial-menu-concept') return 'radial';
  if (window.location.hash === '#/rts') return 'rts';
  if (window.location.hash === '#/packet-builder-and-simulator') return 'packet-builder';
  return 'legacy';
}

function LegacyPage() {
  const [group, setGroup] = React.useState<Group>({ persons: [], size: 0 });
  const municipalities = React.useMemo(() => createNorwayMunicipalities(50,1), []);

  // ---------------- Weights State ----------------
  const [moduleWeights, setModuleWeights] = React.useState<ModuleWeights>({
    capacity: 1,
    workOpportunity: 1,
    connection: 1,
    healthcare: 1,
    education: 1,
  });
  const [capacitySubs, setCapacitySubs] = React.useState<CapacitySubweight[]>([
    { id: 'capacity.core', weight: 1 },
  ]);
  const [capacityOptions, setCapacityOptions] = React.useState<CapacityOptions>({ include_tentative: true, allow_overflow: true });
  const [workSubs, setWorkSubs] = React.useState<WorkSubweight[]>([
    { id: 'work.chance', weight: 1 },
    { id: 'work.growth', weight: 1 },
  ]);
  const [connectionSubs, setConnectionSubs] = React.useState<ConnectionSubweight[]>([
    { id: 'connection.friend', weight: 1 },
    { id: 'connection.close_family', weight: 1 },
    { id: 'connection.relative', weight: 1 },
    { id: 'connection.workplace', weight: 1 },
    { id: 'connection.school_place', weight: 1 },
  ]);
  const [healthcareSubs, setHealthcareSubs] = React.useState<HealthcareSubweight[]>([
    { id: 'healthcare.hospital', weight: 1 },
    { id: 'healthcare.specialist', weight: 1 },
  ]);
  const [educationSubs, setEducationSubs] = React.useState<EducationSubweight[]>([
    { id: 'education.primary_school', weight: 1 },
    { id: 'education.high_school', weight: 1 },
    { id: 'education.university', weight: 1 },
    { id: 'education.adult_language', weight: 1 },
  ]);
  return (
    <div className="p-6 font-sans max-w-screen-2xl mx-auto w-full">
      <div className="flex">
        <div className="hidden md:block" style={{ width: '20%' }} aria-hidden="true" />
        <div className="w-full md:w-[80%]">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Gruppe & Vekter</h1>
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-semibold mb-3 text-gray-700">Gruppe</h2>
              <GroupEditor
                value={group}
                onChange={setGroup}
                municipalities={municipalities}
                regions={regions}
                professions={[...professions]}
              />
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-3 text-gray-700">Vektjustering</h2>
              <WeightEditor
                moduleWeights={moduleWeights}
                onModuleWeightsChange={setModuleWeights}
                capacitySubweights={capacitySubs}
                onCapacitySubweightsChange={setCapacitySubs}
                capacityOptions={capacityOptions}
                onCapacityOptionsChange={setCapacityOptions}
                workSubweights={workSubs}
                onWorkSubweightsChange={setWorkSubs}
                connectionSubweights={connectionSubs}
                onConnectionSubweightsChange={setConnectionSubs}
                healthcareSubweights={healthcareSubs}
                onHealthcareSubweightsChange={setHealthcareSubs}
                educationSubweights={educationSubs}
                onEducationSubweightsChange={setEducationSubs}
              />
            </section>
            <section>
              <MunicipalityScoreTable
                group={group}
                municipalities={municipalities}
                moduleWeights={moduleWeights}
                capacitySubweights={capacitySubs}
                capacityOptions={capacityOptions}
                workSubweights={workSubs}
                connectionSubweights={connectionSubs}
                healthcareSubweights={healthcareSubs}
                educationSubweights={educationSubs}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function RadialMenuConceptPage() {
  return (
    <iframe
      title="Radial menu concept"
      src={`${import.meta.env.BASE_URL}radial-menu-concept.html`}
      allow="pointer-lock"
      className="block min-h-0 w-full flex-1 border-0"
    />
  );
}

function RtsPage() {
  return (
    <iframe
      title="RTS"
      src={`${import.meta.env.BASE_URL}rts.html`}
      allow="pointer-lock"
      className="block min-h-0 w-full flex-1 border-0"
    />
  );
}

function PacketBuilderAndSimulatorPage() {
  return (
    <iframe
      title="Packet builder and simulator"
      src={`${import.meta.env.BASE_URL}packet-builder-and-simulator.html`}
      className="block min-h-0 w-full flex-1 border-0"
    />
  );
}

function App() {
  const [activePage, setActivePage] = React.useState<PageId>(getPageFromHash);
  const isEmbeddedPage = activePage !== 'legacy';

  React.useEffect(() => {
    const handleHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className={`${isEmbeddedPage ? 'flex h-screen flex-col' : 'min-h-screen'} bg-white text-gray-900`}>
      <nav className="sticky top-0 z-50 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {pages.map((page) => {
            const isActive = page.id === activePage;
            return (
              <a
                key={page.id}
                href={page.href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                ].join(' ')}
              >
                {page.label}
              </a>
            );
          })}
        </div>
      </nav>
      {activePage === 'radial' ? (
        <RadialMenuConceptPage />
      ) : activePage === 'rts' ? (
        <RtsPage />
      ) : activePage === 'packet-builder' ? (
        <PacketBuilderAndSimulatorPage />
      ) : (
        <LegacyPage />
      )}
    </div>
  );
}

export default App;
