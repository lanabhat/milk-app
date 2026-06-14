import React, { useState, useEffect } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { API, getAuthHeaders } from '../../utils/api';
import { ITEM_META, CATEGORY_META } from '../../constants/itemMeta';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const CATEGORIES = [
  { value: 'milk',      label: 'Milk & Dairy' },
  { value: 'newspaper', label: 'Newspaper & Magazine' },
  { value: 'other',     label: 'Other' },
];

function ItemThumb({ name, category }) {
  const meta = ITEM_META[name];
  if (meta?.img) {
    return (
      <img src={meta.img} alt={name}
        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; }} />
    );
  }
  const icon = category === 'milk' ? '🥛' : category === 'newspaper' ? '📰' : '📦';
  const bg   = category === 'milk' ? '#e0f2fe' : category === 'newspaper' ? '#fce7f3' : '#f1f5f9';
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
      {icon}
    </div>
  );
}

function SortableRow({ item, arrangeMode, onToggleVisible, onStartEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const cm = CATEGORY_META[item.category] || CATEGORY_META.other;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderLeft: `4px solid ${cm.accent}`,
    borderRadius: 10,
    marginBottom: 6,
    touchAction: arrangeMode ? 'none' : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {arrangeMode && (
        <div {...attributes} {...listeners}
          style={{ cursor: 'grab', color: '#94a3b8', fontSize: 18, flexShrink: 0, touchAction: 'none', userSelect: 'none', padding: '0 4px' }}>
          ⠿
        </div>
      )}
      <ItemThumb name={item.name} category={item.category} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>₹{item.price}/{item.unit} · {cm.label}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onToggleVisible(item)}
          title={item.visible ? 'Hide from catalog' : 'Show in catalog'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2, color: item.visible ? '#0369a1' : '#94a3b8' }}>
          {item.visible ? '👁' : '👁‍🗨'}
        </button>
        <button
          onClick={() => onStartEdit(item)}
          title="Edit"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 2, color: '#64748b' }}>
          ✏️
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: '', price: '', unit: '', category: 'milk' };

export default function CatalogTab({ items, showToast, onSaved }) {
  const [localItems, setLocalItems]   = useState([]);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [showHidden, setShowHidden]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);
  const [editSaving, setEditSaving]   = useState(false);

  useEffect(() => { setLocalItems(items); }, [items]);

  const visibleItems = localItems.filter(i => i.visible !== false);
  const hiddenItems  = localItems.filter(i => i.visible === false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: arrangeMode ? { distance: 5 } : { distance: Infinity },
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleItems.findIndex(i => i.id === active.id);
    const newIndex = visibleItems.findIndex(i => i.id === over.id);
    const reordered = arrayMove(visibleItems, oldIndex, newIndex);
    const newLocal = [...reordered, ...hiddenItems];
    setLocalItems(newLocal);

    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      await fetch(`${API}/api/items/reorder/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((item, idx) => ({ id: item.id, position: idx }))),
      });
      onSaved();
    } catch {
      showToast('Failed to save order', 'error');
      setLocalItems(items);
    }
  };

  const handleToggleVisible = async (item) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: !i.visible } : i));
    try {
      const res = await fetch(`${API}/api/items/${item.id}/`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !item.visible }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      showToast('Failed to update visibility', 'error');
      setLocalItems(items);
    }
  };

  const handleAddSave = async () => {
    if (!addForm.name.trim() || !addForm.price || !addForm.unit.trim()) {
      showToast('Fill in all fields', 'error'); return;
    }
    setAddSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const maxPos = localItems.reduce((m, i) => Math.max(m, i.position || 0), 0);
      const res = await fetch(`${API}/api/items/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addForm.name.trim(), price: parseFloat(addForm.price), unit: addForm.unit.trim(), category: addForm.category, visible: true, position: maxPos + 1 }),
      });
      if (!res.ok) throw new Error();
      setAddForm(EMPTY_FORM);
      setModalOpen(false);
      showToast('✓ Product added');
      onSaved();
    } catch {
      showToast('Failed to add product', 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, price: String(item.price), unit: item.unit, category: item.category });
  };

  const handleEditSubmit = async (e, item) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.price || !editForm.unit.trim()) {
      showToast('Fill in all fields', 'error'); return;
    }
    setEditSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/items/${item.id}/`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name.trim(), price: parseFloat(editForm.price), unit: editForm.unit.trim(), category: editForm.category }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      showToast('✓ Product updated');
      onSaved();
    } catch {
      showToast('Failed to update product', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const InlineEditForm = ({ item }) => (
    <form onSubmit={e => handleEditSubmit(e, item)} style={{ ...s.card, marginBottom: 6, borderLeft: '4px solid #1d4ed8' }}>
      <div className="form-grid">
        <label>Name<input style={s.input} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label>Price (₹)<input style={s.input} type="number" min="0" step="0.01" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} /></label>
        <label>Unit<input style={s.input} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} /></label>
        <label>
          Category
          <select style={s.input} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" disabled={editSaving} style={{ ...s.primaryBtn, flex: 1 }}>
          {editSaving ? 'Saving…' : '✓ Save'}
        </button>
        <button type="button" onClick={() => setEditingId(null)} style={{ ...s.primaryBtn, backgroundColor: '#64748b' }}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ ...s.sectionTitle, margin: 0, flex: 1 }}>Product Catalog</h3>
        <button onClick={() => { setAddForm(EMPTY_FORM); setModalOpen(true); setEditingId(null); }} style={s.addBtn}>
          + Add Product
        </button>
        <button
          onClick={() => setArrangeMode(v => !v)}
          title={arrangeMode ? 'Lock order' : 'Enable rearranging'}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: arrangeMode ? '#f59e0b' : '#64748b' }}>
          {arrangeMode ? '🔓 Arranging…' : '⇄ Arrange'}
        </button>
      </div>

      {arrangeMode && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          ↕ Drag the ⠿ handle to reorder items. Tap <strong>Arrange</strong> again to lock.
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Visible in catalog ({visibleItems.length})
      </div>
      {visibleItems.length === 0 && (
        <p style={s.empty}>No visible products. Add one above or show a hidden product.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {visibleItems.map(item => (
            editingId === item.id
              ? <InlineEditForm key={item.id} item={item} />
              : <SortableRow key={item.id} item={item} arrangeMode={arrangeMode} onToggleVisible={handleToggleVisible} onStartEdit={handleStartEdit} />
          ))}
        </SortableContext>
      </DndContext>

      {hiddenItems.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowHidden(v => !v)}
            style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: 8, fontSize: 12, color: '#64748b', cursor: 'pointer', textAlign: 'left', marginBottom: showHidden ? 8 : 0 }}>
            {showHidden ? '▾' : '▸'} Hidden products ({hiddenItems.length}) — tap to {showHidden ? 'collapse' : 'expand'}
          </button>
          {showHidden && hiddenItems.map(item => {
            if (editingId === item.id) return <InlineEditForm key={item.id} item={item} />;
            const cm = CATEGORY_META[item.category] || CATEGORY_META.other;
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #cbd5e1', borderRadius: 10, marginBottom: 6, opacity: 0.7 }}>
                <ItemThumb name={item.name} category={item.category} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>₹{item.price}/{item.unit} · {cm.label}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleToggleVisible(item)} title="Show in catalog"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2, color: '#94a3b8' }}>
                    👁‍🗨
                  </button>
                  <button onClick={() => handleStartEdit(item)} title="Edit"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 2, color: '#94a3b8' }}>
                    ✏️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setAddForm(EMPTY_FORM); setModalOpen(false); }} title="Add Product"
        onSave={handleAddSave} saveLabel={addSaving ? 'Adding…' : 'Add Product'} saving={addSaving}>
        <div className="form-grid">
          <label>Product Name<input style={s.input} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nandini Toned Milk 1L" /></label>
          <label>Price (₹)<input style={s.input} type="number" min="0" step="0.01" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="28" /></label>
          <label>Unit<input style={s.input} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} placeholder="litre / piece / unit" /></label>
          <label>
            Category
            <select style={s.input} value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
