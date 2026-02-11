import { useState } from 'react'
import PortfolioPath from './PortfolioPath'
import LandingPage from './components/LandingPage'

function App() {
  const [hasEntered, setHasEntered] = useState(() => {
    return sessionStorage.getItem('portfoliopath_entered') === 'true'
  })

  const handleEnter = () => {
    sessionStorage.setItem('portfoliopath_entered', 'true')
    setHasEntered(true)
  }

  if (!hasEntered) {
    return <LandingPage onEnter={handleEnter} />
  }

  return <PortfolioPath />
}

export default App
