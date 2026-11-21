import { fireEvent, render, screen } from '@testing-library/react'
import { PRESETS } from '../core/instruments'
import { InstrumentView } from './InstrumentView'

describe('InstrumentView', () => {
  it('strikes on touch down but selects only after the tap completes', () => {
    const onStrike = vi.fn()
    const onSelect = vi.fn()
    render(
      <InstrumentView
        instrument={PRESETS[0]!}
        labels={{ style: 'letters', naming: 'english' }}
        onStrike={onStrike}
        onSelect={onSelect}
      />,
    )
    const g = screen.getByRole('button', { name: /G \(G4\)/ })
    fireEvent.pointerDown(g)
    expect(onStrike).toHaveBeenCalledWith(67)
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(g)
    expect(onSelect).toHaveBeenCalledWith(67)
  })
})
