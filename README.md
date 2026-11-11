# 🚀 Kubernetes Autoscaling Project

A hands-on learning project to understand and implement **Horizontal Pod Autoscaling (HPA)** in Kubernetes using Docker Desktop, two Node.js microservices, Nginx Ingress, and load testing with `hey`.

---

## 📚 What I Learned

- How to containerize Node.js apps with Docker
- How to write Kubernetes **Deployment**, **Service**, and **Ingress** manifests
- How to set **resource requests and limits** (CPU & memory) on pods — which is *required* for HPA to work
- How **Horizontal Pod Autoscaler (HPA)** automatically scales pods based on CPU usage
- How to simulate real traffic load using [`hey`](https://github.com/rakyll/hey)
- How to observe autoscaling in action using `kubectl top pods` and Docker Desktop's Kubernetes dashboard
- How **inter-service communication** works inside a cluster via ClusterIP Services
- How **Nginx Ingress** routes external traffic to the correct service

---

## 🏗️ Architecture

```
                        ┌─────────────────────────────────────┐
                        │         Kubernetes Cluster           │
  External Traffic      │                                      │
  localhost ──────────► │  Nginx Ingress Controller            │
                        │       /            /api/product      │
                        │       │                 │            │
                        │       ▼                 ▼            │
                        │  main-server-service  product-service│
                        │  (ClusterIP :80)    (ClusterIP :80)  │
                        │       │                 │            │
                        │       ▼                 ▼            │
                        │  autoscale-deployment  product-      │
                        │  (main-server pods)    deployment    │
                        │  min:3 → max:10        (product pods)│
                        │  HPA watches CPU ◄─────────         │
                        └─────────────────────────────────────┘
```

**Flow:**
1. `hey` load tester hits `http://localhost/api/product`
2. Ingress routes it to **product-service** → **product pods**
3. Product pods call `http://main-server-service` (internal DNS)
4. **main-server** runs a CPU-heavy loop (sum 1 to 1 billion)
5. CPU usage spikes → **HPA** detects it and scales up pods automatically

---

## 📁 Project Structure

```
usingKubernets-AutoScaling/
├── Backend/
│   ├── main-server/          # CPU-intensive service (simulates heavy work)
│   │   ├── server.js
│   │   ├── dockerfile
│   │   └── package.json
│   └── product/              # API gateway service (calls main-server)
│       ├── server.js
│       ├── dockerfile
│       └── package.json
├── k8s/                      # Kubernetes manifests
│   ├── deployment.yml        # autoscale-deployment (main-server)
│   ├── deployment-product.yml# product-deployment
│   ├── service.yml           # main-server-service (ClusterIP)
│   ├── service-product.yml   # product-service (ClusterIP)
│   └── ingress.yml           # Nginx Ingress routing rules
├── hey.exe                   # Load testing tool
└── README.md
```

---

## 🔧 Services

### 1. Main Server (`Backend/main-server`)
> The CPU-heavy worker service. It intentionally runs a **sum loop from 1 to 1 billion** on every request to simulate a computationally expensive task — this is what triggers the autoscaler.

- **Port:** 3000
- **Docker Image:** `autoscaling-express:latest`
- **Endpoint:** `GET /` → returns `{ message: "Sum Calculated", sum: ... }`

```js
// Intentionally CPU-intensive to trigger HPA
app.get("/", (req, res) => {
  let sum = 0;
  for (let i = 1; i < 1e9; i++) sum += i;
  res.status(200).json({ message: "Sum Calculated", sum });
});
```

### 2. Product Server (`Backend/product`)
> The API gateway / frontend service. It receives external requests and **proxies them** to the main-server via Kubernetes internal DNS.

- **Port:** 8080
- **Docker Image:** `product-server:latest`
- **Endpoint:** `GET /api/product` → calls `http://main-server-service` and returns its response

```js
app.get('/api/product', async (req, res) => {
  const response = await axios.get("http://main-server-service");
  res.send(response.data);
});
```

---

## ☸️ Kubernetes Manifests

### Deployments (`k8s/deployment.yml` & `k8s/deployment-product.yml`)

Both deployments start with **3 replicas** and define resource requests/limits — **this is mandatory for HPA to function**.

| Field | main-server | product |
|---|---|---|
| Image | `autoscaling-express:latest` | `product-server:latest` |
| Container Port | 3000 | 8080 |
| CPU Request | 250m | 250m |
| CPU Limit | 500m | 500m |
| Memory Request | 64Mi | 64Mi |
| Memory Limit | 128Mi | 128Mi |
| Initial Replicas | 3 | 3 |

> **Key Learning:** Without `resources.requests.cpu` set, HPA cannot calculate utilization percentage and won't scale.

### Services (`k8s/service.yml` & `k8s/service-product.yml`)

Both use **ClusterIP** type — they are only reachable **within the cluster**.

| Service | Selector | Port | Target Port |
|---|---|---|---|
| `main-server-service` | `app: main-server` | 80 | 3000 |
| `product-service` | `app: product` | 80 | 8080 |

Kubernetes automatically creates DNS entries for services, so `http://main-server-service` resolves inside the cluster.

### Ingress (`k8s/ingress.yml`)

Uses **Nginx Ingress Controller** to route external traffic:

| Path | Backend Service | Port |
|---|---|---|
| `/` | `main-server-service` | 80 |
| `/api/product` | `product-service` | 80 |

---

## 🐳 Docker Setup

Both services use the same Dockerfile pattern:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE <PORT>
CMD ["node", "server.js"]
```

### Build Images

```bash
# Build main-server image
cd Backend/main-server
docker build -t autoscaling-express:latest .

# Build product image
cd Backend/product
docker build -t product-server:latest .
```

---

## 🚀 Deployment Steps

### Prerequisites
- Docker Desktop with **Kubernetes enabled**
- `kubectl` CLI
- Nginx Ingress Controller installed

### 1. Install Nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
```

### 2. Apply Kubernetes Manifests

```bash
# Deploy the services
kubectl apply -f ./k8s/deployment.yml
kubectl apply -f ./k8s/deployment-product.yml
kubectl apply -f ./k8s/service.yml
kubectl apply -f ./k8s/service-product.yml
kubectl apply -f ./k8s/ingress.yml
```

### 3. Enable Metrics Server (required for HPA)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

> On Docker Desktop, you may need to patch the metrics-server deployment to add `--kubelet-insecure-tls`.

### 4. Create Horizontal Pod Autoscaler

```bash
kubectl autoscale deployment autoscale-deployment \
  --cpu-percent=50 \
  --min=3 \
  --max=10
```

This tells Kubernetes: *"If average CPU usage across pods exceeds 50%, scale up. Keep between 3 and 10 pods."*

### 5. Verify Everything is Running

```bash
kubectl get deployments
kubectl get pods
kubectl get services
kubectl get hpa
kubectl get ingress
```

---

## 🔥 Load Testing with `hey`

[`hey`](https://github.com/rakyll/hey) is a lightweight HTTP load testing tool (included as `hey.exe`).

### Run Load Test

```bash
# Send 100 total requests with 100 concurrent workers
.\hey.exe -z 2m -c 100 http://localhost/api/product
```

**Flags explained:**
- `-z 2m` → run for 2 minutes
- `-c 100` → 100 concurrent workers

### Sample Load Test Output

```
Status code distribution:
  [200] 145 responses
  [500] 75 responses

Error distribution:
  [532] context deadline exceeded (Client.Timeout exceeded while awaiting headers)
```

> The 500/timeouts are **expected** — the main-server is intentionally slow (1 billion iterations) to spike CPU. The important thing is watching HPA scale pods.

---

## 📊 Observing Autoscaling

### Watch Pods Scale in Real Time

```bash
# In one terminal — continuously watch pod list
while ($true) { kubectl top pods; Start-Sleep -Seconds 2; Clear-Host }

# In another terminal — watch HPA status
kubectl get hpa --watch
```

### Check HPA Details

```bash
kubectl describe hpa autoscale-deployment
```

### View Pod Logs

```bash
kubectl logs deployment/autoscale-deployment --tail=100 -f
kubectl logs deployment/product-deployment --tail=100 -f
```

### Rollout Restart (after rebuilding image)

```bash
kubectl rollout restart deployment/product-deployment
kubectl rollout restart deployment/autoscale-deployment
```

---

## 📈 What Autoscaling Looked Like

From the Docker Desktop Kubernetes dashboard:

| Deployment | Min Pods | Max Pods (under load) | Status |
|---|---|---|---|
| `autoscale-deployment` | 3 | **10** | Available |
| `product-deployment` | 3 | 3 | Available |

Under sustained load, the HPA scaled `autoscale-deployment` from **3 → 10 pods** automatically as CPU usage exceeded the 50% threshold. When load stopped, it scaled back down.

---

## 🧠 Key Concepts Learned

| Concept | Description |
|---|---|
| **HPA** | Horizontal Pod Autoscaler — watches CPU/memory metrics and adjusts replica count |
| **Metrics Server** | Cluster add-on that collects resource usage data, required for HPA |
| **Resource Requests** | Minimum CPU/memory guaranteed to a pod — HPA calculates utilization against this |
| **Resource Limits** | Maximum CPU/memory a pod can use |
| **ClusterIP Service** | Internal-only service, provides stable DNS name for pod-to-pod communication |
| **Ingress** | Routes external HTTP/S traffic to internal services based on path/host rules |
| **`hey`** | Go-based HTTP load testing tool, similar to `ab` (Apache Bench) |
| **`kubectl top pods`** | Shows live CPU and memory usage per pod (requires metrics-server) |

---

## ⚠️ Common Issues & Fixes

**HPA shows `<unknown>` for CPU targets:**
```bash
# Metrics server not running or needs --kubelet-insecure-tls flag
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

**Pods not pulling updated local image:**
```bash
# Always tag with a version or use imagePullPolicy: Always
kubectl rollout restart deployment/<deployment-name>
```

**Ingress not routing:**
```bash
# Check ingress controller is running
kubectl get pods -n ingress-nginx
```

---

## 🛠️ Tech Stack

| Tool | Version / Notes |
|---|---|
| **Node.js** | 20 (Alpine Docker image) |
| **Express.js** | v5.x |
| **axios** | v1.x (product service HTTP client) |
| **morgan** | HTTP request logger middleware |
| **Docker Desktop** | Kubernetes enabled (single-node cluster) |
| **Kubernetes** | 1.x via Docker Desktop |
| **Nginx Ingress** | ingress-nginx controller |
| **hey** | HTTP load testing binary |

---

*Built to understand Kubernetes autoscaling from scratch — from writing Dockerfiles to watching pods spin up under real load.* 🎯

