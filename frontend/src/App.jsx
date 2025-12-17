import PortfolioPath from './PortfolioPath'
import AuthGate from './components/AuthGate'

function App() {
  return (
    <AuthGate>
      <PortfolioPath />
    </AuthGate>
  )
}

export default App
