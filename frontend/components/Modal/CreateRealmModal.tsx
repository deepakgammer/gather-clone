// frontend/components/Modal/CreateRealmModal.tsx
'use client'

import React from 'react'
import Modal from './Modal'
import { useModal } from '@/app/hooks/useModal'
import BasicButton from '../BasicButton'

/**
 * CreateRealmModal (disabled version)
 * -----------------------------------
 * ‑ Shows an informational message.
 * ‑ No DB writes; “Close” returns to previous screen.
 */
const CreateRealmModal: React.FC = () => {
  const { modal, setModal } = useModal()

  /** Close modal helper */
  const close = () => setModal('None')

  return (
    <Modal open={modal === 'Create Realm'} closeOnOutsideClick>
      <div className="flex flex-col items-center gap-6 p-8 w-[360px]">
        <h1 className="text-2xl font-bold text-center">Space creation disabled</h1>

        <p className="text-center text-sm opacity-80">
          Sorry! Creating new spaces is currently turned off.  
          You can still join existing spaces from the Menu.
        </p>

        <BasicButton className="w-32" onClick={close}>
          Close
        </BasicButton>
      </div>
    </Modal>
  )
}

export default CreateRealmModal
