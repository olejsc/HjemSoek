import React from 'react';
import type { Group, ModuleWeights, CapacitySubweight, WorkSubweight, ConnectionSubweight, HealthcareSubweight, EducationSubweight } from './types';
import GroupEditor from './components/GroupEditor';
import WeightEditor from './components/WeightEditor';
import MunicipalityScoreTable from './components/MunicipalityScoreTable';
import { createNorwayMunicipalities, regions, professions } from './mockdata';

function App() {
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

export default App;
