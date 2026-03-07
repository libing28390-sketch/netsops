import React from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from '../types';
import { sectionHeaderRowClass, primaryActionBtnClass } from '../components/shared';

interface UsersTabProps {
  users: User[];
  showAddUserModal: boolean;
  setShowAddUserModal: (v: boolean) => void;
  showEditUserModal: boolean;
  setShowEditUserModal: (v: boolean) => void;
  editingUser: User | null;
  setEditingUser: (u: User | null) => void;
  newUserForm: { username: string; password: string; role: string };
  setNewUserForm: (v: { username: string; password: string; role: string }) => void;
  editUserForm: { username: string; password: string; role: string };
  setEditUserForm: (v: { username: string; password: string; role: string }) => void;
  showNewUserPwd: boolean;
  setShowNewUserPwd: (fn: (v: boolean) => boolean) => void;
  showEditUserPwd: boolean;
  setShowEditUserPwd: (fn: (v: boolean) => boolean) => void;
  handleAddUser: () => void;
  handleEditUser: () => void;
  language: string;
  t: (key: string) => string;
}

const UsersTab: React.FC<UsersTabProps> = ({
  users, showAddUserModal, setShowAddUserModal,
  showEditUserModal, setShowEditUserModal,
  editingUser, setEditingUser,
  newUserForm, setNewUserForm, editUserForm, setEditUserForm,
  showNewUserPwd, setShowNewUserPwd, showEditUserPwd, setShowEditUserPwd,
  handleAddUser, handleEditUser, language, t,
}) => {
  return (
    <div className="space-y-8">
      <div className={sectionHeaderRowClass}>
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{t('userManagement')}</h2>
          <p className="text-sm text-black/40">{t('manageAccess')}</p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className={primaryActionBtnClass}
        >
          <Plus size={18} />
          {t('addUser')}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/[0.01] border-b border-black/5">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">{t('username')}</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">{t('role')}</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">{t('status')}</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">{t('lastLogin')}</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center text-xs font-bold">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{user.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs">{user.role}</td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-black/40">{user.lastLogin}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setEditUserForm({ username: user.username, password: '', role: user.role });
                      setShowEditUserModal(true);
                    }}
                    className="text-[10px] font-bold uppercase text-black/40 hover:text-black"
                  >{t('edit')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-black/5 overflow-hidden"
          >
            <div className="p-8">
              <h3 className="text-xl font-medium mb-6">{t('addNewUser')}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('username')}</label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all"
                    placeholder="e.g. jdoe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('password')}</label>
                  <div className="relative">
                    <input
                      type={showNewUserPwd ? 'text' : 'password'}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowNewUserPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
                      {showNewUserPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('role')}</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all bg-white"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Operator">Operator</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-medium hover:bg-black/5 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                >
                  {t('create')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-black/5 overflow-hidden"
          >
            <div className="p-8">
              <h3 className="text-xl font-medium mb-6">编辑用户</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('username')}</label>
                  <input
                    type="text"
                    value={editUserForm.username}
                    onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('password')} <span className="text-black/30 normal-case font-normal">（留空则不修改）</span></label>
                  <div className="relative">
                    <input
                      type={showEditUserPwd ? 'text' : 'password'}
                      value={editUserForm.password}
                      onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowEditUserPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
                      {showEditUserPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">{t('role')}</label>
                  <select
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all bg-white"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Operator">Operator</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-medium hover:bg-black/5 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleEditUser}
                  className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
