import { useCallback, useEffect, useState } from 'react';
import { Check, Circle, Focus, Lightbulb, Plus, RefreshCw, Search, Pencil, Trash2, Route, Wand2, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import master from '@/lib/roadmap/master.json';
import { needsFocusWarning, statusLabels, roadmapStatusMeaning, findExistingIdea, filterRoadmapIdeas } from '@/lib/roadmap/rules';
import { reconcile, findEvidence, evidenceLabel, isCodeVerified, needsRealWorldProof } from '@/lib/roadmap/evidence';

type Item = Tables<'roadmap_items'>;
type Version = Tables<'roadmap_versions'>;
type Proposal = { id: string; title: string; version_id: string | null; reason: string; effort: 'small' | 'medium' | 'large'; status: string; evidence: string };
const phaseNames = ['Lanzamiento y día a día', 'Inteligencia y adaptación', 'Análisis físico y visión', 'Ecosistema y comunidad'];
const effortLabels = { small: 'Rápido', medium: 'Medio', large: 'Grande' };

export default function RoadmapAdmin() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('1.0');
  const [search, setSearch] = useState('');
  const [catalogVersion, setCatalogVersion] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [duplicates, setDuplicates] = useState<{ title: string; existing: Item }[]>([]);
  const [ideas, setIdeas] = useState(() => localStorage.getItem('autopilot:roadmap-ideas') ?? '');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [versionEdit, setVersionEdit] = useState<Version | null>(null);
  const [focusAction, setFocusAction] = useState<(() => Promise<void>) | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [aiHelp, setAiHelp] = useState<Item | null>(null);
  const [proofFor, setProofFor] = useState<Item | null>(null);
  const [proofText, setProofText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [v, i] = await Promise.all([
        supabase.from('roadmap_versions').select('*').order('position'),
        supabase.from('roadmap_items').select('*').order('position').order('created_at'),
      ]);
      if (v.error || i.error) throw v.error ?? i.error;
      if (!v.data?.length) {
        const seedV = await supabase.from('roadmap_versions').upsert(master.versions, { onConflict: 'id', ignoreDuplicates: true });
        if (seedV.error) throw seedV.error;
      }
      // Missing IDs are inserted, never replacing saved edits or completion states.
      const savedIds = new Set((i.data ?? []).map(row => row.id));
      const needsSeed = !v.data?.some(row => row.seed_initialized);
      const missing = needsSeed ? master.items.filter(row => !savedIds.has(row.id)).map(row => ({ ...row, status: 'idea', evidence: '' })) : [];
      if (missing.length) {
        const seeded = await supabase.from('roadmap_items').upsert(missing, { onConflict: 'id', ignoreDuplicates: true });
        if (seeded.error) throw seeded.error;
      }
      if (needsSeed) {
        const marked = await supabase.from('roadmap_versions').update({ seed_initialized: true }).in('id', master.versions.map(row => row.id));
        if (marked.error) throw marked.error;
      }
      let finalV = v.data ?? [], finalI = i.data ?? [];
      if (!v.data?.length || needsSeed) {
        const [freshV, freshI] = await Promise.all([supabase.from('roadmap_versions').select('*').order('position'), supabase.from('roadmap_items').select('*').order('position').order('created_at')]);
        if (freshV.error || freshI.error) throw freshV.error ?? freshI.error;
        finalV = freshV.data ?? []; finalI = freshI.data ?? [];
      }
      // Cada carga alinea el Roadmap con lo que el código demuestra.
      for (const p of reconcile(finalI)) {
        const r = await supabase.from('roadmap_items').update({ status: p.status, evidence: p.evidence, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (r.error) throw r.error;
        finalI = finalI.map(row => row.id === p.id ? { ...row, ...p } : row);
      }
      setVersions(finalV); setItems(finalI);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { localStorage.setItem('autopilot:roadmap-ideas', ideas); }, [ideas]);
  const current = versions.find(v => v.is_current);
  const active = versions.find(v => v.id === selected);
  const currentTasks = items.filter(i => i.version_id === current?.id);
  const done = currentTasks.filter(i => i.status === 'done').length;
  const percent = currentTasks.length ? Math.round(done / currentTasks.length * 100) : 0;
  const futureWork = items.filter(i => i.status === 'pending' && i.version_id !== current?.id);
  const inbox = items.filter(i => i.status === 'idea');
  const matches = (i: Item) => `${i.title} ${i.description}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'));
  const selectedTasks = items.filter(i => (selected === 'ice' ? !i.version_id : i.version_id === selected) && matches(i));
  const ideaGroups = versions.map(v => ({ version: v, groupIdeas: inbox.filter(i => i.version_id === v.id) })).filter(g => g.groupIdeas.length > 0);
  const iceIdeas = inbox.filter(i => !i.version_id || !versions.some(v => v.id === i.version_id));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch { toast.error('No se pudo guardar. Tus cambios no se han aplicado.'); } finally { setBusy(false); }
  }
  async function updateItem(id: string, patch: Partial<Item>) {
    const result = await supabase.from('roadmap_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (result.error) throw result.error;
    setItems(prev => prev.map(i => i.id === id ? result.data : i));
  }
  function changeStatus(item: Item, status: string, proof?: string) {
    const code = findEvidence(item.title);
    if (code && status !== 'done') { toast.info('El código demuestra que esta función ya existe; sigue como Hecho.'); return; }
    if (status === 'done' && !code && !proof) { setProofFor(item); setProofText(''); return; }
    const evidence = status === 'done' ? (code ? evidenceLabel(code) : `Confirmado por ti · ${proof}`) : '';
    const action = () => updateItem(item.id, { status, evidence });
    if (needsFocusWarning(item.version_id, current?.id ?? '1.0', status)) { setFocusAction(() => action); } else { void run(action); }
  }
  async function saveTask() {
    if (!editing?.title?.trim()) return;
    const draft = { title: editing.title.trim().slice(0, 250), description: editing.description ?? '', version_id: editing.version_id ?? null, effort: editing.effort ?? 'medium', status: editing.status ?? 'idea' };
    const action = async () => {
      if (editing.id) await updateItem(editing.id, draft);
      else {
        const { data, error: saveError } = await supabase.from('roadmap_items').insert({ ...draft, position: items.length }).select().single();
        if (saveError) throw saveError;
        setItems(prev => [...prev, data]);
      }
      setEditing(null); toast.success('Tarea guardada');
    };
    if (needsFocusWarning(draft.version_id, current?.id ?? '1.0', draft.status)) setFocusAction(() => action);
    else await run(action);
  }
  async function captureIdeas() {
    const lines = ideas.split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    await run(async () => {
      const fresh = await supabase.from('roadmap_items').select('*');
      if (fresh.error) throw fresh.error;
      const existingItems = fresh.data ?? [];
      const repeated: { title: string; existing: Item }[] = [];
      const unique: string[] = [];
      for (const line of lines.slice(0, 100)) {
        const match = findExistingIdea(line.slice(0, 250), existingItems);
        if (match) repeated.push({ title: line, existing: match });
        else if (!findExistingIdea(line.slice(0, 250), unique.map(title => ({ title: title.slice(0, 250) })))) unique.push(line);
      }
      setDuplicates(repeated);
      if (!unique.length) { setIdeas(lines.slice(100).join('\n')); toast.info('Estas ideas ya están en el Roadmap.'); return; }
      const { data, error: saveError } = await supabase.from('roadmap_items').insert(unique.map((line, idx) => ({ title: line.slice(0, 250), description: line.length > 250 ? line : '', status: 'idea', source: 'brainstorm', position: items.length + idx }))).select();
      if (saveError) throw saveError;
      setItems(prev => [...prev, ...(data ?? [])]);
      setIdeas(lines.slice(100).join('\n')); toast.success('Ideas guardadas');
    });
  }
  async function classify(target: Item[]) {
    if (!target.length) return;
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('roadmap-ai', { body: { item_ids: target.slice(0, 25).map(i => i.id) } });
      if (invokeError) {
        let detail = 'No se pudo ordenar con IA. Tus ideas siguen guardadas.';
        try { const payload = await invokeError.context?.json(); if (payload?.error) detail = payload.error; } catch { /* preserve ideas */ }
        toast.error(detail); return;
      }
      if (data?.error) { toast.error(data.error); return; }
      setProposals(data?.proposals ?? []);
    } catch { toast.error('No se pudo conectar con la IA. Tus ideas siguen guardadas.'); } finally { setBusy(false); }
  }
  async function applyProposals() {
    await run(async () => {
      // Per-item updates preserve all unrelated columns and manual notes.
      for (const p of proposals) await updateItem(p.id, { ...(p.title?.trim() ? { title: p.title.trim().slice(0, 80) } : {}), version_id: p.version_id, status: p.status, evidence: p.evidence || items.find(i => i.id === p.id)?.evidence || '', effort: p.effort, ai_reason: p.reason });
      setProposals([]); toast.success('Propuestas aplicadas');
    });
  }
  function taskCard(item: Item) {
    return <article key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-3 min-w-0">
      <div className="flex items-start gap-3">
        <Checkbox className="mt-1 shrink-0" aria-label={`Completar ${item.title}`} checked={item.status === 'done'} disabled={busy} onCheckedChange={value => changeStatus(item, value ? 'done' : 'idea')} />
        <div className="min-w-0 flex-1"><h3 className={`font-semibold break-words ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{item.title}</h3><p className="text-sm text-muted-foreground mt-1 break-words">{item.description}</p></div>
        <Button variant="ghost" size="icon" aria-label={`Editar ${item.title}`} title="Editar tarea" onClick={() => setEditing(item)}><Pencil /></Button>
      </div>
      {item.evidence && <p className={`text-xs break-words flex gap-2 ${isCodeVerified(item.evidence) ? 'text-primary' : 'text-muted-foreground'}`}><Check className="size-3 shrink-0 mt-0.5" />{item.evidence}</p>}
      {item.status !== 'done' && needsRealWorldProof.includes(item.title) && <p className="text-xs text-muted-foreground">Necesita prueba real (tienda, cobro o dispositivo); el código solo no basta.</p>}
      {item.ai_reason && <p className="text-xs text-muted-foreground break-words">{item.ai_reason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={item.status} onValueChange={status => changeStatus(item, status)} disabled={busy}><SelectTrigger className="w-36 h-9" aria-label={`Estado de ${item.title}`} title={roadmapStatusMeaning(item.status as keyof typeof statusLabels)}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label} · {roadmapStatusMeaning(key as keyof typeof statusLabels)}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs text-muted-foreground">{effortLabels[item.effort as keyof typeof effortLabels]}{item.version_id ? ` · v${item.version_id}` : ' · Hielo'}</span>
        <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground" title="Eliminar tarea" aria-label={`Eliminar ${item.title}`} onClick={() => setDeleting(item)}><Trash2 /></Button>
      </div>
      {item.status !== 'done' && <Button variant="ghost" size="sm" onClick={() => setAiHelp(item)}><Wand2 />Ayuda de IA</Button>}
    </article>;
  }
  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  if (error) return <div className="py-12 space-y-4"><p>No se pudo cargar el Roadmap.</p><Button onClick={() => { setLoading(true); void load(); }}><RefreshCw />Reintentar</Button></div>;

  return <div className="max-w-7xl mx-auto space-y-7 pb-6">
    <section className="border-b border-border pb-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase text-muted-foreground font-semibold">Autopilot · Dirección de producto</p><h2 className="type-title1 mt-2 flex items-center gap-2"><Focus className="size-6 text-primary" />Foco: v{current?.id ?? '1.0'}</h2></div><Button variant="ghost" size="icon" aria-label="Actualizar Roadmap" title="Actualizar" disabled={busy} onClick={() => void load()}><RefreshCw /></Button></div>
      <p className="text-muted-foreground mt-2">{current?.title}</p>
      <div className="mt-4 flex items-center gap-4 max-w-lg"><Progress value={percent} className="h-1.5" /><span className="text-xs tabular-nums whitespace-nowrap">{done}/{currentTasks.length} hechos</span></div>
      {futureWork.length > 0 && <div role="status" className="mt-4 flex items-start gap-3 text-sm text-primary"><Focus className="size-4 shrink-0 mt-0.5" /><p>{futureWork.length} tareas fuera del foco están en curso. Prioridad ahora: v{current?.id}, {currentTasks.find(i => i.status !== 'done')?.title ?? 'validar esta versión'}.</p></div>}
    </section>
    <Tabs defaultValue="versions">
      <TabsList className="max-w-full"><TabsTrigger value="versions"><Route className="size-4 mr-2" />Versiones</TabsTrigger><TabsTrigger value="ideas"><Lightbulb className="size-4 mr-2" />Ideas ({inbox.length})</TabsTrigger><TabsTrigger value="history"><Archive className="size-4 mr-2" />Historial</TabsTrigger></TabsList>
      <TabsContent value="versions" className="mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
          <div className="lg:hidden"><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Seleccionar versión"><SelectValue /></SelectTrigger><SelectContent>{versions.map(v => <SelectItem key={v.id} value={v.id}>v{v.id} · {v.title}{v.is_current ? ' · Actual' : ''}</SelectItem>)}<SelectItem value="ice">Ideas en hielo</SelectItem></SelectContent></Select></div>
          <nav aria-label="Versiones del Roadmap" className="hidden lg:block lg:border-r lg:border-border lg:pr-4 space-y-3">
            {[1,2,3,4].map(phase => <div key={phase}><p className="text-xs text-muted-foreground mb-2">{phase} · {phaseNames[phase-1]}</p><div className="grid grid-cols-5 lg:grid-cols-2 gap-1">{versions.filter(v => v.phase === phase).map(v => <Button key={v.id} variant={selected === v.id ? 'tinted' : 'ghost'} size="sm" aria-label={`Ver versión ${v.id}`} aria-pressed={selected === v.id} onClick={() => setSelected(v.id)} className="justify-start"><span className="tabular-nums">{v.id}</span>{v.is_current && <Circle className="size-2 fill-current" />}</Button>)}</div></div>)}
            <Button variant={selected === 'ice' ? 'tinted' : 'ghost'} onClick={() => setSelected('ice')}><Archive />Ideas en hielo</Button>
          </nav>
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-primary">{selected === current?.id ? 'VERSIÓN ACTUAL' : selected === 'ice' ? 'SIN FECHA' : 'POR DELANTE'}</p><h3 className="type-title2 mt-1 break-words">{selected === 'ice' ? 'Hielo' : `v${selected} · ${active?.title ?? ''}`}</h3></div>{active && <Button variant="ghost" size="icon" aria-label="Editar versión" title="Editar versión" onClick={() => setVersionEdit(active)}><Pencil /></Button>}</div>
            <p className="text-sm text-muted-foreground">{active?.objective}</p>
            <div className="flex flex-wrap gap-2"><div className="relative min-w-40 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar tareas" placeholder="Buscar tareas" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div><Button variant="secondary" onClick={() => setEditing({ title: '', version_id: selected === 'ice' ? null : selected })}><Plus />Tarea</Button><Button variant="tinted" disabled={busy || !selectedTasks.filter(i => i.status !== 'done').length} onClick={() => void classify(selectedTasks.filter(i => i.status !== 'done'))}>{busy ? <Spinner /> : <Wand2 />}Revisar con IA</Button></div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{selectedTasks.map(taskCard)}</div>
            {!selectedTasks.length && <p className="py-10 text-muted-foreground text-center">No hay tareas aquí.</p>}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="ideas" className="mt-6 space-y-5">
        <h3 className="type-title2">Lluvia de ideas</h3>
        <Textarea aria-label="Lluvia de ideas" placeholder="Una idea por línea…" value={ideas} onChange={e => setIdeas(e.target.value)} className="min-h-40" />
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !ideas.trim()} onClick={() => void captureIdeas()}><Plus />Guardar ideas</Button><Button variant="tinted" disabled={busy || !inbox.length} onClick={() => void classify(inbox)}>{busy ? <Spinner /> : <Wand2 />}Ordenar con IA{inbox.length > 25 ? ' (25)' : ''}</Button></div>
        {duplicates.length > 0 && <section role="status" className="space-y-2 border-l-2 border-primary pl-4"><h4 className="font-semibold">Ya están en el Roadmap</h4>{duplicates.map((row, index) => <p key={index} className="text-sm break-words">{row.title} · {row.existing.version_id ? `v${row.existing.version_id}` : 'Hielo'} · {statusLabels[row.existing.status as keyof typeof statusLabels]}{row.existing.status === 'done' ? ' · Ya implementado' : ''}</p>)}</section>}
        <div className="space-y-6">
          {ideaGroups.map(({ version, groupIdeas }) => (
            <section key={version.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="font-semibold">v{version.id} · {version.title}</h4>
                {version.id === current?.id && <span className="text-xs text-primary">Versión actual</span>}
                <span className="text-xs text-muted-foreground">{groupIdeas.length} idea{groupIdeas.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{groupIdeas.map(taskCard)}</div>
            </section>
          ))}
          {iceIdeas.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="font-semibold">Hielo · sin versión asignada</h4>
                <span className="text-xs text-muted-foreground">{iceIdeas.length} idea{iceIdeas.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{iceIdeas.map(taskCard)}</div>
            </section>
          )}
        </div>
        {!inbox.length && <p className="text-muted-foreground py-6">Sin ideas pendientes de ordenar.</p>}
        <section className="border-t border-border pt-6 space-y-4"><h3 className="type-title2">Consultar ideas y tareas</h3><div className="flex flex-wrap gap-3"><Select value={catalogVersion} onValueChange={setCatalogVersion}><SelectTrigger className="w-full sm:w-64" aria-label="Filtrar ideas por versión"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las versiones</SelectItem>{versions.map(v => <SelectItem key={v.id} value={v.id}>v{v.id} · {v.title}</SelectItem>)}<SelectItem value="ice">Hielo</SelectItem></SelectContent></Select><Input aria-label="Buscar ideas en el Roadmap" placeholder="Buscar ideas y tareas" className="flex-1 min-w-40" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} /></div><p className="text-sm text-muted-foreground">{filterRoadmapIdeas(items, catalogVersion, catalogSearch).length} ideas y tareas</p><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filterRoadmapIdeas(items, catalogVersion, catalogSearch).map(taskCard)}</div></section>
      </TabsContent>
      <TabsContent value="history" className="mt-6 space-y-5">
        <h3 className="type-title2">Historial de versiones</h3>
        {versions.filter(v => v.release_stage !== 'internal' || v.release_notes || items.some(i => i.version_id === v.id && i.status === 'done')).map(v => <section key={v.id} className="py-4 border-b border-border space-y-2"><div className="flex justify-between gap-3"><h4 className="font-semibold">v{v.id} · {v.title}</h4><Button variant="ghost" size="icon" aria-label={`Editar versión ${v.id}`} onClick={() => setVersionEdit(v)}><Pencil /></Button></div><p className="text-xs text-primary">{{ internal: 'Desarrollo interno', beta: 'Beta', rc: 'Candidata', released: 'Publicada' }[v.release_stage]}</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.release_notes}</p>{items.filter(i => i.version_id === v.id && i.status === 'done').map(i => <p key={i.id} className="text-sm flex gap-2"><Check className="size-4 text-primary shrink-0" />{i.title}</p>)}</section>)}
      </TabsContent>
    </Tabs>
    <Dialog open={!!aiHelp} onOpenChange={open => { if (!open) setAiHelp(null); }}><DialogContent><DialogHeader><DialogTitle>Implementar con ayuda de IA</DialogTitle><DialogDescription>La IA puede ayudarte a desarrollar esta tarea en Lovable. Algunas partes pueden requerir servicios externos o pruebas reales; el Roadmap no cambia ni publica la aplicación automáticamente.</DialogDescription></DialogHeader><p className="font-semibold">{aiHelp?.title}</p><Textarea aria-label="Petición para Lovable" readOnly value={aiHelp ? `Revisa si ya existe «${aiHelp.title}» en Autopilot. Si falta, impleméntalo y pruébalo sin ampliar el alcance. Versión: ${aiHelp.version_id ?? 'Hielo'}. Detalles: ${aiHelp.description}. Marca Hecho solo con evidencia verificable y avisa si está fuera del foco actual.` : ''} /><Button onClick={async () => { if (!aiHelp) return; try { await navigator.clipboard.writeText(`Revisa si ya existe «${aiHelp.title}» en Autopilot. Si falta, impleméntalo y pruébalo sin ampliar el alcance. Versión: ${aiHelp.version_id ?? 'Hielo'}. Detalles: ${aiHelp.description}. Marca Hecho solo con evidencia verificable y avisa si está fuera del foco actual.`); toast.success('Petición copiada para Lovable'); } catch { toast.error('No se pudo copiar; puedes seleccionar el texto.'); } }}>Copiar petición</Button></DialogContent></Dialog>
    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?.id ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle><DialogDescription>Alcance de la versión</DialogDescription></DialogHeader><label className="text-sm space-y-2">Título<Input value={editing?.title ?? ''} maxLength={250} onChange={e => setEditing(prev => ({ ...prev, title: e.target.value }))} /></label><label className="text-sm space-y-2">Detalles<Textarea value={editing?.description ?? ''} onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))} /></label><label className="text-sm">Versión<Select value={editing?.version_id ?? 'ice'} onValueChange={value => setEditing(prev => ({ ...prev, version_id: value === 'ice' ? null : value }))}><SelectTrigger aria-label="Versión de tarea"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ice">Hielo</SelectItem>{versions.map(v => <SelectItem key={v.id} value={v.id}>v{v.id} · {v.title}</SelectItem>)}</SelectContent></Select></label><label className="text-sm">Esfuerzo<Select value={editing?.effort ?? 'medium'} onValueChange={value => setEditing(prev => ({ ...prev, effort: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(effortLabels).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label><Button disabled={busy || !editing?.title?.trim()} onClick={() => void saveTask()}>Guardar tarea</Button></DialogContent></Dialog>
    <Dialog open={!!versionEdit} onOpenChange={open => { if (!open) setVersionEdit(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Versión {versionEdit?.id}</DialogTitle><DialogDescription>Objetivo y lanzamiento</DialogDescription></DialogHeader><label className="text-sm">Nombre<Input value={versionEdit?.title ?? ''} onChange={e => setVersionEdit(prev => prev ? { ...prev, title: e.target.value } : null)} /></label><label className="text-sm">Objetivo<Textarea value={versionEdit?.objective ?? ''} onChange={e => setVersionEdit(prev => prev ? { ...prev, objective: e.target.value } : null)} /></label><Select value={versionEdit?.release_stage ?? 'internal'} onValueChange={value => setVersionEdit(prev => prev ? { ...prev, release_stage: value } : null)}><SelectTrigger aria-label="Etapa de lanzamiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Desarrollo interno</SelectItem><SelectItem value="beta">Beta</SelectItem><SelectItem value="rc">Candidata de lanzamiento</SelectItem><SelectItem value="released">Publicada</SelectItem></SelectContent></Select><label className="text-sm">Notas de versión<Textarea value={versionEdit?.release_notes ?? ''} onChange={e => setVersionEdit(prev => prev ? { ...prev, release_notes: e.target.value } : null)} /></label><Button disabled={busy || !versionEdit?.title.trim()} onClick={() => void run(async () => { if (!versionEdit) return; const { error: saveError } = await supabase.from('roadmap_versions').update({ title: versionEdit.title, objective: versionEdit.objective, release_stage: versionEdit.release_stage, release_notes: versionEdit.release_notes, updated_at: new Date().toISOString() }).eq('id', versionEdit.id); if (saveError) throw saveError; setVersionEdit(null); await load(); toast.success('Versión guardada'); })}>Guardar versión</Button>{versionEdit && !versionEdit.is_current && <Button variant="secondary" disabled={busy} onClick={() => setFocusAction(() => async () => { const { error: switchError } = await supabase.rpc('roadmap_set_current', { target: versionEdit.id }); if (switchError) throw switchError; setVersionEdit(null); await load(); toast.success('Foco actualizado'); })}><Focus />Establecer como actual</Button>}</DialogContent></Dialog>
    <Dialog open={!!focusAction} onOpenChange={open => { if (!open) setFocusAction(null); }}><DialogContent><DialogHeader><DialogTitle>Mantén el foco</DialogTitle><DialogDescription>Ahora: v{current?.id} · {current?.title}. Aún quedan {currentTasks.length - done} tareas pendientes. ¿Quieres cambiar el foco o empezar esta tarea igualmente?</DialogDescription></DialogHeader><Button onClick={() => setFocusAction(null)}>Seguir con v{current?.id}</Button><Button variant="secondary" disabled={busy} onClick={() => { const action = focusAction; if (action) void run(async () => { await action(); setFocusAction(null); }); }}>Continuar igualmente</Button></DialogContent></Dialog>
    <Dialog open={!!proofFor} onOpenChange={open => { if (!open) setProofFor(null); }}><DialogContent><DialogHeader><DialogTitle>¿Cómo sabes que está hecho?</DialogTitle><DialogDescription>«{proofFor?.title}» no tiene prueba en el código. Escribe qué lo demuestra (p. ej. «compra real probada el 18/10»). Se mostrará como confirmado por ti, no como verificado.</DialogDescription></DialogHeader><Textarea aria-label="Prueba de finalización" value={proofText} maxLength={300} onChange={e => setProofText(e.target.value)} /><Button disabled={busy || proofText.trim().length < 10} onClick={() => { if (proofFor) changeStatus(proofFor, 'done', proofText.trim()); setProofFor(null); }}>Marcar como Hecho</Button></DialogContent></Dialog>
    <Dialog open={!!deleting}  onOpenChange={open => { if (!open) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Eliminar tarea</DialogTitle><DialogDescription>¿Eliminar «{deleting?.title}»? No se puede deshacer.</DialogDescription></DialogHeader><Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void run(async () => { if (!deleting) return; const { error: deleteError } = await supabase.from('roadmap_items').delete().eq('id', deleting.id); if (deleteError) throw deleteError; setItems(prev => prev.filter(i => i.id !== deleting.id)); setDeleting(null); })}>Eliminar</Button></DialogContent></Dialog>
    <Dialog open={proposals.length > 0} onOpenChange={open => { if (!open) setProposals([]); }}><DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Propuesta de orden</DialogTitle><DialogDescription>La IA propone; tú decides qué se guarda.</DialogDescription></DialogHeader>{proposals.map((p, idx) => <div key={p.id} className="py-3 border-b border-border space-y-2"><Input aria-label={`Título propuesto ${idx+1}`} value={p.title ?? ''} maxLength={80} onChange={e => setProposals(prev => prev.map((row,n) => n === idx ? { ...row, title: e.target.value } : row))} className="font-semibold" />{items.find(i => i.id === p.id)?.title !== p.title && <p className="text-xs text-muted-foreground">Escrito por ti: {items.find(i => i.id === p.id)?.title}</p>}<Select value={p.version_id ?? 'ice'} onValueChange={value => setProposals(prev => prev.map((row,n) => n === idx ? { ...row, version_id: value === 'ice' ? null : value } : row))}><SelectTrigger aria-label={`Destino de propuesta ${idx+1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ice">Hielo</SelectItem>{versions.map(v => <SelectItem key={v.id} value={v.id}>v{v.id} · {v.title}</SelectItem>)}</SelectContent></Select><p className="text-sm text-muted-foreground">{p.reason}</p>{p.evidence && <p className="text-xs text-primary">Ya implementado · {p.evidence}</p>}<Button variant="ghost" size="sm" onClick={() => setProposals(prev => prev.filter(row => row.id !== p.id))}>Descartar propuesta</Button></div>)}<Button disabled={busy} onClick={() => void applyProposals()}><Check />Aplicar propuestas ({proposals.length})</Button></DialogContent></Dialog>
  </div>;
}