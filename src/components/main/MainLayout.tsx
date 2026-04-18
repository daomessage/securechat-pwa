import { useAppStore, selectTotalUnread } from '../../store/appStore';
import { NetworkBanner } from './NetworkBanner';
import { MessagesTab } from '../tabs/MessagesTab';
import { ContactsTab } from '../tabs/ContactsTab';
import { ChannelsTab } from '../tabs/ChannelsTab';
import { SettingsTab } from '../tabs/SettingsTab';
import { ChannelDetail } from '../tabs/ChannelDetail';
import { InstallBanner } from '../pwa/InstallBanner';
import { MessageSquare, Users2, Hash, Settings } from 'lucide-react';
import React from 'react';

export function MainLayout() {
  const { activeTab, setActiveTab, pendingRequestCount, activeChannelId } = useAppStore();
  const totalUnread = useAppStore(selectTotalUnread);

  if (activeChannelId) return <ChannelDetail />;

  return (
    <div className="flex flex-col vv-height bg-zinc-950 text-white pt-safe">
      <NetworkBanner />
      {/* 跨平台安装横幅:iOS Safari 引导 + Android Chrome 一键装 */}
      <InstallBanner />
      <div className="flex-1 overflow-y-auto scroll-contain w-full max-w-2xl mx-auto flex flex-col relative pb-[calc(env(safe-area-inset-bottom)+70px)]">
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'channels' && <ChannelsTab />}
        {activeTab === 'contacts' && <ContactsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
      
      {/* 底部 Tab 栏 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 pb-safe">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto px-4 pb-2">
          <TabButton tab="messages" current={activeTab} onClick={() => setActiveTab('messages')} label="会话" badge={totalUnread} icon={<MessageSquare className="w-6 h-6" />} />
          <TabButton tab="channels" current={activeTab} onClick={() => setActiveTab('channels')} label="频道" icon={<Hash className="w-6 h-6" />} />
          <TabButton tab="contacts" current={activeTab} onClick={() => setActiveTab('contacts')} label="联系人" badge={pendingRequestCount} icon={<Users2 className="w-6 h-6" />} />
          <TabButton tab="settings" current={activeTab} onClick={() => setActiveTab('settings')} label="设置" icon={<Settings className="w-6 h-6" />} />
        </div>
      </div>
    </div>
  );
}

function TabButton({ tab, current, label, badge, icon, onClick }: { tab: string, current: string, label: string, badge?: number, icon: React.ReactNode, onClick: () => void }) {
  const active = tab === current;
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${active ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <div className="relative">
        {icon}
        {(badge ?? 0) > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 border-2 border-zinc-950 shadow-sm leading-none flex items-center justify-center min-w-[20px]">
            {badge! > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );
}
