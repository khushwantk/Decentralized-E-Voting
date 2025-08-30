import React, { useState, useEffect, useCallback } from "react";

const CountdownTimer = ({ endTime }) => {
  const calculateTimeLeft = useCallback(() => {
    const difference = +new Date(endTime) - +new Date();
    if (difference <= 0) return null;
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }, [endTime]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearTimeout(timer);
  });

  if (!timeLeft) {
    return <div className="countdown-timer ended">Voting has ended!</div>;
  }

  return (
    <div className="countdown-timer active">
      {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      left
    </div>
  );
};

export default CountdownTimer;
