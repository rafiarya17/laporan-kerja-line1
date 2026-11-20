import DashboardClient from './DashboardClient';
import formMapping from '../../constants/formMapping.json';

export const metadata = {title:'Dashboard Welding · Berlindo'};

export default function DashboardPage() {
  const machines = Object.entries(formMapping).flatMap(([key, config]) => {
    const line = Number(key.replace('LINE_', ''));
    return Object.keys(config.mesin_part_mapping)
      .filter(name => !(line === 1 && name === 'AUTO CHAMPER'))
      .map(name => ({ id: key + ':' + name, line, name }));
  });
  machines.push({ id: 'LINE_99:AUTO_CHAMPER', line: 99, name: 'AUTO CHAMPER' });
  return <main><DashboardClient machines={machines} /></main>;
}
