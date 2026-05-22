import { useState, useCallback, useRef } from 'react';
import { MAX_HISTORY_POINTS } from '../constants';
import {
  runPingTest,
  runDownloadTest,
  runUploadTest,
  fetchNetworkInfo,
} from '../services/speedTestService';

/**
 * useSpeedTest
 *
 * Encapsulates all speed-test state and orchestration logic.
 * Returns state values plus { startTest, stopTest, resetTest }.
 */
export function useSpeedTest() {
  const [phase, setPhase]                   = useState(null);
  const [phaseProgress, setPhaseProgress]   = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [realTimeSpeed, setRealTimeSpeed]   = useState(0);
  const [speedHistory, setSpeedHistory]     = useState([]);
  const [results, setResults]               = useState(null);
  const [networkInfo, setNetworkInfo]       = useState(null);
  const [error, setError]                   = useState(null);
  const [isTesting, setIsTesting]           = useState(false);

  const abortRef        = useRef(null);
  const speedHistoryRef = useRef([]);

  // ── Push a new speed sample to the live history ──────────────────────────────
  const addSpeedPoint = useCallback((mbps) => {
    speedHistoryRef.current.push({
      t: (speedHistoryRef.current.length * 0.15).toFixed(1),
      speed: Math.round(mbps * 10) / 10,
    });
    if (speedHistoryRef.current.length > MAX_HISTORY_POINTS) {
      speedHistoryRef.current.shift();
    }
    setSpeedHistory([...speedHistoryRef.current]);
  }, []);

  // ── Speed update handler (used by download & upload) ─────────────────────────
  const handleSpeedUpdate = useCallback((mbps) => {
    setRealTimeSpeed(mbps);
    addSpeedPoint(mbps);
  }, [addSpeedPoint]);

  // ─── Start / orchestrate test ─────────────────────────────────────────────────
  const startTest = useCallback(async () => {
    setIsTesting(true);
    setError(null);
    setResults(null);
    setOverallProgress(0);
    setRealTimeSpeed(0);
    speedHistoryRef.current = [];
    setSpeedHistory([]);

    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      // Kick off IP lookup in parallel — we await it later
      const ipPromise = fetchNetworkInfo(signal);

      // 1. Ping
      setPhase('ping');
      setPhaseProgress(0);
      const pingData = await runPingTest(signal, setPhaseProgress);
      setOverallProgress(25);

      // 2. Download
      setPhase('download');
      setPhaseProgress(0);
      setRealTimeSpeed(0);
      speedHistoryRef.current = [];
      const dlData = await runDownloadTest(signal, setPhaseProgress, handleSpeedUpdate);
      setOverallProgress(65);

      // 3. Upload
      setPhase('upload');
      setPhaseProgress(0);
      setRealTimeSpeed(0);
      const ulData = await runUploadTest(signal, setPhaseProgress, handleSpeedUpdate);
      setOverallProgress(85);

      // Await IP lookup
      const ip = await ipPromise;
      if (ip) setNetworkInfo(ip);

      setPhase('done');
      await new Promise((r) => setTimeout(r, 500));

      setResults({
        downloadSpeed: dlData.downloadSpeed,
        downloadMbps:  dlData.downloadMbps,
        uploadSpeed:   ulData.uploadSpeed,
        uploadMbps:    ulData.uploadMbps,
        ping:          pingData.ping,
        jitter:        pingData.jitter,
        packetLoss:    pingData.packetLoss,
        speedHistory:  [...speedHistoryRef.current],
      });
      setOverallProgress(100);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError('Test failed. Please check your connection and try again.');
      }
    } finally {
      setIsTesting(false);
      setPhase(null);
    }
  }, [handleSpeedUpdate]);

  // ─── Stop mid-test ────────────────────────────────────────────────────────────
  const stopTest = useCallback(() => {
    abortRef.current?.abort();
    setIsTesting(false);
    setPhase(null);
    setRealTimeSpeed(0);
  }, []);

  // ─── Reset to initial state ───────────────────────────────────────────────────
  const resetTest = useCallback(() => {
    setResults(null);
    setError(null);
    setNetworkInfo(null);
    speedHistoryRef.current = [];
    setSpeedHistory([]);
    setOverallProgress(0);
    setPhaseProgress(0);
    setRealTimeSpeed(0);
    setPhase(null);
  }, []);

  return {
    // State
    phase,
    phaseProgress,
    overallProgress,
    realTimeSpeed,
    speedHistory,
    results,
    networkInfo,
    error,
    isTesting,
    // Actions
    startTest,
    stopTest,
    resetTest,
  };
}
